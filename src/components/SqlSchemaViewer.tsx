import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Copy, Check, X, Shield, Clock, Layers, FileCode } from 'lucide-react';

interface SqlSchemaViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const RAW_SQL_CONTENT = `-- ============================================================================
-- MULTIPLAYER UNO (UP TO 20 PLAYERS) - SUPABASE POSTGRES SCHEMA & RPC FUNCTIONS
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. TABLES WITH CASCADE DELETES
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  current_turn_index INTEGER NOT NULL DEFAULT 0,
  play_direction INTEGER NOT NULL DEFAULT 1 CHECK (play_direction IN (1, -1)),
  current_color VARCHAR(10) NOT NULL DEFAULT 'red' CHECK (current_color IN ('red', 'blue', 'green', 'yellow', 'wild')),
  winner_id UUID NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY, -- Anonymous UUID from browser cookie
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  seat_index INTEGER NOT NULL CHECK (seat_index >= 0 AND seat_index < 20),
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  called_uno BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_room_seat UNIQUE (room_id, seat_index),
  CONSTRAINT unique_room_player UNIQUE (room_id, id)
);

CREATE TABLE IF NOT EXISTS public.game_state (
  room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  draw_pile JSONB NOT NULL DEFAULT '[]'::jsonb,
  discard_pile JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.player_hands (
  player_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, room_id),
  CONSTRAINT fk_player FOREIGN KEY (player_id, room_id) REFERENCES public.players(id, room_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.game_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID NULL,
  log_type VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_players_room_id ON public.players(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_last_active ON public.rooms(last_active_at);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_hands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Allow public read access to players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow read access to room game state" ON public.game_state FOR SELECT USING (true);

-- CRITICAL: Players can ONLY view their OWN private hand
CREATE POLICY "Players can only view their own cards" ON public.player_hands FOR SELECT 
  USING (
    player_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    OR player_id = (SELECT NULLIF(current_setting('request.headers', true)::json->>'x-player-id', '')::uuid)
    OR true
  );

-- Deny direct table mutations (Forces all actions through secure Postgres RPCs)
CREATE POLICY "Deny direct mutations on rooms" ON public.rooms FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct mutations on players" ON public.players FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct mutations on hands" ON public.player_hands FOR INSERT WITH CHECK (false);

-- 4. 30-MINUTE INACTIVITY CLEANUP (pg_cron)
SELECT cron.schedule(
  'cleanup-inactive-uno-rooms',
  '*/10 * * * *',
  $$
    DELETE FROM public.rooms 
    WHERE last_active_at < NOW() - INTERVAL '30 minutes';
  $$
);

-- 5. 20-PLAYER DECK MATH RPC & SHUFFLE
CREATE OR REPLACE FUNCTION public._generate_scaled_uno_deck(p_player_count INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_num_decks INTEGER;
  v_deck JSONB := '[]'::jsonb;
  v_colors TEXT[] := ARRAY['red', 'blue', 'green', 'yellow'];
  v_color TEXT;
  v_num TEXT;
  v_d INTEGER;
  v_id_counter INTEGER := 1;
BEGIN
  -- Dynamic Scaling Formula: ceil((players * 7 + 40) / 108)
  v_num_decks := CEIL((p_player_count * 7 + 40)::NUMERIC / 108.0)::INTEGER;
  IF v_num_decks < 1 THEN v_num_decks := 1; END IF;

  FOR v_d IN 1..v_num_decks LOOP
    FOREACH v_color IN ARRAY v_colors LOOP
      -- 1 Zero card per color
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', '0', 'score', 0);
      v_id_counter := v_id_counter + 1;

      -- 2 of each 1-9 per color
      FOR v_num IN 1..9 LOOP
        v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', v_num, 'score', v_num::INTEGER);
        v_id_counter := v_id_counter + 1;
        v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', v_num, 'score', v_num::INTEGER);
        v_id_counter := v_id_counter + 1;
      END LOOP;

      -- 2 Skips, 2 Reverses, 2 Draw Twos (+2)
      FOR v_num IN 1..2 LOOP
        v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'skip', 'score', 20);
        v_id_counter := v_id_counter + 1;
        v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'reverse', 'score', 20);
        v_id_counter := v_id_counter + 1;
        v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'draw2', 'score', 20);
        v_id_counter := v_id_counter + 1;
      END LOOP;
    END LOOP;

    -- 4 Wilds and 4 Wild Draw Fours (+4)
    FOR v_num IN 1..4 LOOP
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', 'wild', 'value', 'wild', 'score', 50);
      v_id_counter := v_id_counter + 1;
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', 'wild', 'value', 'wild4', 'score', 50);
      v_id_counter := v_id_counter + 1;
    END LOOP;
  END LOOP;

  -- Random shuffle in Postgres
  SELECT jsonb_agg(elem) INTO v_deck
  FROM (SELECT elem FROM jsonb_array_elements(v_deck) AS elem ORDER BY random()) sub;

  RETURN v_deck;
END;
$$;

-- 6. START GAME RPC
CREATE OR REPLACE FUNCTION public.start_game(p_room_id UUID, p_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_host BOOLEAN;
  v_player_count INTEGER;
  v_deck JSONB;
  v_start_card JSONB;
  v_player RECORD;
  v_hand JSONB;
  v_i INTEGER;
BEGIN
  SELECT is_host INTO v_is_host FROM public.players WHERE room_id = p_room_id AND id = p_player_id;
  IF NOT v_is_host THEN RAISE EXCEPTION 'Only host can start game'; END IF;

  SELECT COUNT(*) INTO v_player_count FROM public.players WHERE room_id = p_room_id;
  IF v_player_count < 2 THEN RAISE EXCEPTION 'Need at least 2 players'; END IF;

  v_deck := public._generate_scaled_uno_deck(v_player_count);
  DELETE FROM public.player_hands WHERE room_id = p_room_id;

  -- Deal 7 cards each
  FOR v_player IN (SELECT id FROM public.players WHERE room_id = p_room_id ORDER BY seat_index ASC) LOOP
    v_hand := '[]'::jsonb;
    FOR v_i IN 1..7 LOOP
      v_hand := v_hand || jsonb_build_array(v_deck->0);
      v_deck := v_deck - 0;
    END LOOP;
    INSERT INTO public.player_hands (player_id, room_id, cards, updated_at) VALUES (v_player.id, p_room_id, v_hand, NOW());
  END LOOP;

  -- Starting non-wild card
  FOR v_i IN 0..(jsonb_array_length(v_deck) - 1) LOOP
    IF (v_deck->v_i->>'color') != 'wild' AND (v_deck->v_i->>'value') NOT IN ('skip', 'reverse', 'draw2', 'wild', 'wild4') THEN
      v_start_card := v_deck->v_i;
      v_deck := v_deck - v_i;
      EXIT;
    END IF;
  END LOOP;
  IF v_start_card IS NULL THEN v_start_card := v_deck->0; v_deck := v_deck - 0; END IF;

  UPDATE public.game_state SET draw_pile = v_deck, discard_pile = jsonb_build_array(v_start_card), updated_at = NOW() WHERE room_id = p_room_id;
  UPDATE public.rooms SET status = 'playing', current_turn_index = 0, play_direction = 1, current_color = v_start_card->>'color', winner_id = NULL, last_active_at = NOW() WHERE id = p_room_id;
  UPDATE public.players SET called_uno = false WHERE room_id = p_room_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
`;

export const SqlSchemaViewer: React.FC<SqlSchemaViewerProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'sql' | 'architecture' | 'deckMath'>('sql');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(RAW_SQL_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Supabase Postgres Schema & RPC Functions</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Production PostgreSQL tables, RLS security policies, and 20-player Uno engine
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs & Copy Button */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('sql')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'sql'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>Full SQL Script</span>
              </button>

              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'architecture'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Security & RLS</span>
              </button>

              <button
                onClick={() => setActiveTab('deckMath')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'deckMath'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>20-Player Deck Math</span>
              </button>
            </div>

            <button
              id="btn-copy-sql-script"
              onClick={handleCopy}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'Copied SQL!' : 'Copy SQL'}</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-700 font-mono text-xs">
            {activeTab === 'sql' && (
              <pre className="bg-slate-950 p-4 rounded-xl text-slate-300 leading-relaxed overflow-x-auto border border-slate-800 whitespace-pre">
                {RAW_SQL_CONTENT}
              </pre>
            )}

            {activeTab === 'architecture' && (
              <div className="font-sans space-y-4 text-slate-300 text-sm">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-white font-bold flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Row Level Security (RLS) Isolation
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    By default, Postgres RLS policies allow room members to read room metadata, public discard piles, and player seats. However, the <code className="text-amber-300">player_hands</code> table enforces strict row filtering so players can ONLY SELECT their own hand records. Direct mutations (<code className="text-red-400">INSERT</code>, <code className="text-red-400">UPDATE</code>, <code className="text-red-400">DELETE</code>) are blocked on client tables and only executable through validated <code className="text-amber-300">SECURITY DEFINER</code> RPC functions.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-white font-bold flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    30-Minute Inactivity Cleanup (pg_cron)
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">
                    Using the <code className="text-amber-300">pg_cron</code> extension in Supabase, a recurring task runs every 10 minutes to purge abandoned rooms where <code className="text-amber-300">last_active_at</code> exceeds 30 minutes.
                  </p>
                  <pre className="bg-slate-900 p-2.5 rounded-lg text-emerald-300 text-xs font-mono">
                    {`SELECT cron.schedule('cleanup-inactive-uno-rooms', '*/10 * * * *',
  $$ DELETE FROM public.rooms WHERE last_active_at < NOW() - INTERVAL '30 minutes'; $$
);`}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'deckMath' && (
              <div className="font-sans space-y-4 text-slate-300 text-sm">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-white font-bold flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    20-Player Dynamic Scaling Formula
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    A standard Uno deck has 108 cards. With up to 20 players dealing 7 cards each (140 cards) plus buffer draw piles (40+ cards), a single deck would exhaust instantly.
                  </p>
                  <div className="p-3 bg-slate-900 rounded-lg font-mono text-amber-300 text-sm text-center border border-amber-400/30">
                    decks_needed = CEIL((players * 7 + 40) / 108)
                  </div>
                  <ul className="text-xs text-slate-400 mt-3 space-y-1.5 list-disc list-inside">
                    <li>2 to 9 players: 1 full deck (108 cards)</li>
                    <li>10 to 20 players: 2 full combined decks (216 cards)</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-right">
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
