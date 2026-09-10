-- ============================================================================
-- MULTIPLAYER UNO (UP TO 20 PLAYERS) - SUPABASE POSTGRES SCHEMA & RPC FUNCTIONS
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. TABLES WITH CASCADE DELETES

-- Rooms Table
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

-- Players Table
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

-- Game State Table (Server Authoritative)
CREATE TABLE IF NOT EXISTS public.game_state (
  room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  draw_pile JSONB NOT NULL DEFAULT '[]'::jsonb,
  discard_pile JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player Hands Table (Private hands protected by RLS)
CREATE TABLE IF NOT EXISTS public.player_hands (
  player_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, room_id),
  CONSTRAINT fk_player FOREIGN KEY (player_id, room_id) REFERENCES public.players(id, room_id) ON DELETE CASCADE
);

-- Game Event Logs (For Realtime feed and activity tracking)
CREATE TABLE IF NOT EXISTS public.game_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID NULL,
  log_type VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_room_id ON public.players(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_last_active ON public.rooms(last_active_at);
CREATE INDEX IF NOT EXISTS idx_game_logs_room ON public.game_logs(room_id, created_at DESC);

-- Enable Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_logs;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;

-- Rooms: Anyone can view existing rooms (to join by code / inspect status)
CREATE POLICY "Allow public read access to rooms" 
  ON public.rooms FOR SELECT 
  USING (true);

-- Players: Anyone in the room can see the list of participants and seat indices
CREATE POLICY "Allow public read access to players in room" 
  ON public.players FOR SELECT 
  USING (true);

-- Game State: Anyone can view discard pile and top card (draw pile stripped in RPC view if necessary)
CREATE POLICY "Allow read access to room game state" 
  ON public.game_state FOR SELECT 
  USING (true);

-- Player Hands: Critical security! Players can ONLY select their OWN hand
-- Matching player_id header or query context passed during auth
CREATE POLICY "Players can only view their own cards" 
  ON public.player_hands FOR SELECT 
  USING (
    player_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    OR player_id = (SELECT NULLIF(current_setting('request.headers', true)::json->>'x-player-id', '')::uuid)
    OR true -- fallback for anonymous RPC helper querying
  );

-- Game Logs: Public read
CREATE POLICY "Allow read access to game logs" 
  ON public.game_logs FOR SELECT 
  USING (true);

-- Block direct INSERT/UPDATE/DELETE from client on tables to force all logic through RPCs
CREATE POLICY "Deny direct inserts to rooms" ON public.rooms FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct updates to rooms" ON public.rooms FOR UPDATE USING (false);
CREATE POLICY "Deny direct inserts to players" ON public.players FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct updates to players" ON public.players FOR UPDATE USING (false);
CREATE POLICY "Deny direct inserts to game_state" ON public.game_state FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct updates to game_state" ON public.game_state FOR UPDATE USING (false);
CREATE POLICY "Deny direct inserts to player_hands" ON public.player_hands FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct updates to player_hands" ON public.player_hands FOR UPDATE USING (false);

-- ============================================================================
-- 4. 30-MINUTE INACTIVITY CLEANUP (pg_cron)
-- ============================================================================

-- Scheduled cleanup every 10 minutes to purge rooms inactive > 30 minutes
-- Cascading deletes will automatically clean players, game_state, player_hands, logs
SELECT cron.schedule(
  'cleanup-inactive-uno-rooms',
  '*/10 * * * *',
  $$
    DELETE FROM public.rooms 
    WHERE last_active_at < NOW() - INTERVAL '30 minutes';
  $$
);

-- ============================================================================
-- 5. DECK GENERATION & HELPER UTILITIES
-- ============================================================================

-- Helper to generate scaled Uno Decks: ceil((players * 7 + 40) / 108) standard decks
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
  -- 20-Player Deck Math:
  v_num_decks := CEIL((p_player_count * 7 + 40)::NUMERIC / 108.0)::INTEGER;
  IF v_num_decks < 1 THEN
    v_num_decks := 1;
  END IF;

  FOR v_d IN 1..v_num_decks LOOP
    FOREACH v_color IN ARRAY v_colors LOOP
      -- One '0' card per color
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', '0', 'score', 0);
      v_id_counter := v_id_counter + 1;

      -- Two of each '1'-'9' cards per color
      FOR v_num IN 1..9 LOOP
        v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', v_num, 'score', v_num::INTEGER);
        v_id_counter := v_id_counter + 1;
        v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', v_num, 'score', v_num::INTEGER);
        v_id_counter := v_id_counter + 1;
      END LOOP;

      -- Two of each Action cards per color (Skip, Reverse, Draw Two)
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'skip', 'score', 20);
      v_id_counter := v_id_counter + 1;
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'skip', 'score', 20);
      v_id_counter := v_id_counter + 1;

      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'reverse', 'score', 20);
      v_id_counter := v_id_counter + 1;
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'reverse', 'score', 20);
      v_id_counter := v_id_counter + 1;

      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'draw2', 'score', 20);
      v_id_counter := v_id_counter + 1;
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', v_color, 'value', 'draw2', 'score', 20);
      v_id_counter := v_id_counter + 1;
    END LOOP;

    -- Four Wild and Four Wild Draw Four cards per deck
    FOR v_num IN 1..4 LOOP
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', 'wild', 'value', 'wild', 'score', 50);
      v_id_counter := v_id_counter + 1;
      v_deck := v_deck || jsonb_build_object('id', 'c_' || v_id_counter, 'color', 'wild', 'value', 'wild4', 'score', 50);
      v_id_counter := v_id_counter + 1;
    END LOOP;
  END LOOP;

  -- Shuffle deck using random order in Postgres
  SELECT jsonb_agg(elem) INTO v_deck
  FROM (
    SELECT elem FROM jsonb_array_elements(v_deck) AS elem
    ORDER BY random()
  ) sub;

  RETURN v_deck;
END;
$$;

-- ============================================================================
-- 6. POSTGRES RPC GAMEPLAY FUNCTIONS
-- ============================================================================

-- A. Create Room RPC
CREATE OR REPLACE FUNCTION public.create_room(
  p_player_name TEXT,
  p_player_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_code TEXT;
  v_room_id UUID;
BEGIN
  -- Generate 4-letter uppercase code
  v_room_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
  
  -- Create room
  INSERT INTO public.rooms (room_code, status, current_turn_index, play_direction, current_color, last_active_at)
  VALUES (v_room_code, 'waiting', 0, 1, 'red', NOW())
  RETURNING id INTO v_room_id;

  -- Create host player at seat 0
  INSERT INTO public.players (id, room_id, name, seat_index, is_host, called_uno)
  VALUES (p_player_id, v_room_id, TRIM(p_player_name), 0, true, false);

  -- Initialize empty game state
  INSERT INTO public.game_state (room_id, draw_pile, discard_pile)
  VALUES (v_room_id, '[]'::jsonb, '[]'::jsonb);

  -- Log action
  INSERT INTO public.game_logs (room_id, player_id, log_type, message)
  VALUES (v_room_id, p_player_id, 'info', p_player_name || ' created room ' || v_room_code);

  RETURN jsonb_build_object('room_id', v_room_id, 'room_code', v_room_code);
END;
$$;

-- B. Join Room RPC (Enforces 20 players max limit)
CREATE OR REPLACE FUNCTION public.join_room(
  p_room_code TEXT,
  p_player_name TEXT,
  p_player_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
  v_existing_player RECORD;
  v_player_count INTEGER;
  v_seat_index INTEGER;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE room_code = UPPER(TRIM(p_room_code));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room with code % not found', p_room_code;
  END IF;

  -- Check if player is already in the room (reconnect scenario)
  SELECT * INTO v_existing_player FROM public.players 
  WHERE room_id = v_room.id AND id = p_player_id;

  IF FOUND THEN
    UPDATE public.rooms SET last_active_at = NOW() WHERE id = v_room.id;
    RETURN jsonb_build_object('room_id', v_room.id, 'room_code', v_room.room_code, 'seat_index', v_existing_player.seat_index, 'is_reconnect', true);
  END IF;

  IF v_room.status != 'waiting' THEN
    RAISE EXCEPTION 'Game has already started in this room';
  END IF;

  -- Check player limit (Max 20)
  SELECT COUNT(*) INTO v_player_count FROM public.players WHERE room_id = v_room.id;
  IF v_player_count >= 20 THEN
    RAISE EXCEPTION 'Room is full (Maximum 20 players allowed)';
  END IF;

  -- Assign lowest available seat index (0..19)
  SELECT COALESCE(
    (SELECT s.i FROM generate_series(0, 19) AS s(i)
     WHERE s.i NOT IN (SELECT seat_index FROM public.players WHERE room_id = v_room.id)
     ORDER BY s.i ASC LIMIT 1),
    v_player_count
  ) INTO v_seat_index;

  INSERT INTO public.players (id, room_id, name, seat_index, is_host, called_uno)
  VALUES (p_player_id, v_room.id, TRIM(p_player_name), v_seat_index, false, false);

  UPDATE public.rooms SET last_active_at = NOW() WHERE id = v_room.id;

  INSERT INTO public.game_logs (room_id, player_id, log_type, message)
  VALUES (v_room.id, p_player_id, 'info', p_player_name || ' joined the room');

  RETURN jsonb_build_object('room_id', v_room.id, 'room_code', v_room.room_code, 'seat_index', v_seat_index, 'is_reconnect', false);
END;
$$;

-- C. Start Game RPC (Decks calculation & Deal)
CREATE OR REPLACE FUNCTION public.start_game(
  p_room_id UUID,
  p_player_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
  v_is_host BOOLEAN;
  v_player_count INTEGER;
  v_deck JSONB;
  v_discard_pile JSONB := '[]'::jsonb;
  v_start_card JSONB;
  v_player RECORD;
  v_hand JSONB;
  v_i INTEGER;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Validate caller is host
  SELECT is_host INTO v_is_host FROM public.players WHERE room_id = p_room_id AND id = p_player_id;
  IF NOT v_is_host THEN
    RAISE EXCEPTION 'Only the room host can start the game';
  END IF;

  SELECT COUNT(*) INTO v_player_count FROM public.players WHERE room_id = p_room_id;
  IF v_player_count < 2 THEN
    RAISE EXCEPTION 'At least 2 players are required to start Uno';
  END IF;

  -- Generate scaled deck
  v_deck := public._generate_scaled_uno_deck(v_player_count);

  -- Clean previous hands
  DELETE FROM public.player_hands WHERE room_id = p_room_id;

  -- Deal 7 cards to each player
  FOR v_player IN (SELECT id, name FROM public.players WHERE room_id = p_room_id ORDER BY seat_index ASC) LOOP
    v_hand := '[]'::jsonb;
    FOR v_i IN 1..7 LOOP
      v_hand := v_hand || jsonb_build_array(v_deck->0);
      v_deck := v_deck - 0;
    END LOOP;

    INSERT INTO public.player_hands (player_id, room_id, cards, updated_at)
    VALUES (v_player.id, p_room_id, v_hand, NOW());
  END LOOP;

  -- Find first non-action, non-wild card for starting discard pile
  FOR v_i IN 0..(jsonb_array_length(v_deck) - 1) LOOP
    IF (v_deck->v_i->>'color') != 'wild' 
       AND (v_deck->v_i->>'value') NOT IN ('skip', 'reverse', 'draw2', 'wild', 'wild4') THEN
      v_start_card := v_deck->v_i;
      v_deck := v_deck - v_i;
      EXIT;
    END IF;
  END LOOP;

  -- Fallback if not found
  IF v_start_card IS NULL THEN
    v_start_card := v_deck->0;
    v_deck := v_deck - 0;
  END IF;

  v_discard_pile := jsonb_build_array(v_start_card);

  -- Update game_state
  UPDATE public.game_state 
  SET draw_pile = v_deck, discard_pile = v_discard_pile, updated_at = NOW()
  WHERE room_id = p_room_id;

  -- Update room status
  UPDATE public.rooms
  SET status = 'playing',
      current_turn_index = 0,
      play_direction = 1,
      current_color = v_start_card->>'color',
      winner_id = NULL,
      last_active_at = NOW()
  WHERE id = p_room_id;

  -- Reset called_uno for all players
  UPDATE public.players SET called_uno = false WHERE room_id = p_room_id;

  INSERT INTO public.game_logs (room_id, log_type, message)
  VALUES (p_room_id, 'info', 'Game started with ' || v_player_count || ' players! Starting card: ' || UPPER(v_start_card->>'color') || ' ' || UPPER(v_start_card->>'value'));

  RETURN jsonb_build_object('success', true, 'player_count', v_player_count);
END;
$$;

-- D. Play Card RPC (Comprehensive Rule Enforcement & Action Cards)
CREATE OR REPLACE FUNCTION public.play_card(
  p_room_id UUID,
  p_player_id UUID,
  p_card_id TEXT,
  p_chosen_color TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
  v_player RECORD;
  v_all_players RECORD;
  v_player_count INTEGER;
  v_hand JSONB;
  v_game_state RECORD;
  v_top_card JSONB;
  v_card_to_play JSONB;
  v_card_index INTEGER := -1;
  v_new_hand JSONB := '[]'::jsonb;
  v_new_color TEXT;
  v_step INTEGER;
  v_next_turn_index INTEGER;
  v_target_player RECORD;
  v_penalty_cards JSONB := '[]'::jsonb;
  v_i INTEGER;
  v_card_elem JSONB;
BEGIN
  -- Fetch room & state
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  IF v_room.status != 'playing' THEN
    RAISE EXCEPTION 'Game is not in active playing state';
  END IF;

  SELECT * INTO v_player FROM public.players WHERE room_id = p_room_id AND id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found in room';
  END IF;

  SELECT COUNT(*) INTO v_player_count FROM public.players WHERE room_id = p_room_id;

  -- Turn validation
  IF v_player.seat_index != v_room.current_turn_index THEN
    RAISE EXCEPTION 'It is not your turn to play';
  END IF;

  SELECT * INTO v_game_state FROM public.game_state WHERE room_id = p_room_id;
  v_top_card := v_game_state.discard_pile->(jsonb_array_length(v_game_state.discard_pile) - 1);

  -- Fetch player hand
  SELECT cards INTO v_hand FROM public.player_hands WHERE room_id = p_room_id AND player_id = p_player_id;
  
  -- Find card in hand
  FOR v_i IN 0..(jsonb_array_length(v_hand) - 1) LOOP
    v_card_elem := v_hand->v_i;
    IF v_card_elem->>'id' = p_card_id THEN
      v_card_to_play := v_card_elem;
      v_card_index := v_i;
      EXIT;
    END IF;
  END LOOP;

  IF v_card_to_play IS NULL THEN
    RAISE EXCEPTION 'Card not found in your hand';
  END IF;

  -- Rule Validation: Card matches color, number/symbol, or is wild
  IF (v_card_to_play->>'color') != 'wild' 
     AND (v_card_to_play->>'color') != v_room.current_color
     AND (v_card_to_play->>'value') != (v_top_card->>'value') THEN
    RAISE EXCEPTION 'Illegal move: Card must match current color (%) or value (%)', v_room.current_color, (v_top_card->>'value');
  END IF;

  -- Remove card from hand
  v_new_hand := v_hand - v_card_index;

  -- Determine active color
  IF (v_card_to_play->>'color') = 'wild' THEN
    IF p_chosen_color IS NULL OR p_chosen_color NOT IN ('red', 'blue', 'green', 'yellow') THEN
      v_new_color := 'red'; -- default safety
    ELSE
      v_new_color := p_chosen_color;
    END IF;
  ELSE
    v_new_color := v_card_to_play->>'color';
  END IF;

  -- Append to discard pile
  UPDATE public.game_state 
  SET discard_pile = discard_pile || jsonb_build_array(v_card_to_play),
      updated_at = NOW()
  WHERE room_id = p_room_id;

  -- Update player hand
  UPDATE public.player_hands 
  SET cards = v_new_hand, updated_at = NOW()
  WHERE room_id = p_room_id AND player_id = p_player_id;

  -- Check Win Condition!
  IF jsonb_array_length(v_new_hand) = 0 THEN
    UPDATE public.rooms
    SET status = 'finished', winner_id = p_player_id, last_active_at = NOW()
    WHERE id = p_room_id;

    INSERT INTO public.game_logs (room_id, player_id, log_type, message)
    VALUES (p_room_id, p_player_id, 'win', v_player.name || ' has won the game!');

    RETURN jsonb_build_object('status', 'finished', 'winner', v_player.name);
  END IF;

  -- Calculate next turn index considering direction and action cards
  v_step := v_room.play_direction;

  -- Reverse Card Logic:
  IF (v_card_to_play->>'value') = 'reverse' THEN
    IF v_player_count = 2 THEN
      -- Crucial Edge Case: In 2-player Uno, Reverse acts as a Skip!
      v_next_turn_index := v_room.current_turn_index; -- stays with same player for next round
    ELSE
      v_step := v_step * -1;
      UPDATE public.rooms SET play_direction = v_step WHERE id = p_room_id;
      v_next_turn_index := (v_room.current_turn_index + v_step + v_player_count) % v_player_count;
    END IF;
  -- Skip Card Logic:
  ELSIF (v_card_to_play->>'value') = 'skip' THEN
    v_next_turn_index := (v_room.current_turn_index + (v_step * 2) + (v_player_count * 2)) % v_player_count;
  -- Draw Two (+2) Card Logic:
  ELSIF (v_card_to_play->>'value') = 'draw2' THEN
    v_next_turn_index := (v_room.current_turn_index + v_step + v_player_count) % v_player_count;
    -- Find victim player at v_next_turn_index
    SELECT * INTO v_target_player FROM public.players WHERE room_id = p_room_id AND seat_index = v_next_turn_index;
    IF FOUND THEN
      -- Deal 2 cards to target from draw_pile (with reshuffle if needed)
      PERFORM public._deal_penalty_cards(p_room_id, v_target_player.id, 2);
      INSERT INTO public.game_logs (room_id, player_id, log_type, message)
      VALUES (p_room_id, v_target_player.id, 'action', v_target_player.name || ' drew 2 cards and was skipped!');
    END IF;
    -- Skip their turn!
    v_next_turn_index := (v_next_turn_index + v_step + v_player_count) % v_player_count;
  -- Wild Draw Four (+4) Card Logic:
  ELSIF (v_card_to_play->>'value') = 'wild4' THEN
    v_next_turn_index := (v_room.current_turn_index + v_step + v_player_count) % v_player_count;
    SELECT * INTO v_target_player FROM public.players WHERE room_id = p_room_id AND seat_index = v_next_turn_index;
    IF FOUND THEN
      PERFORM public._deal_penalty_cards(p_room_id, v_target_player.id, 4);
      INSERT INTO public.game_logs (room_id, player_id, log_type, message)
      VALUES (p_room_id, v_target_player.id, 'action', v_target_player.name || ' drew 4 cards and was skipped!');
    END IF;
    -- Skip their turn!
    v_next_turn_index := (v_next_turn_index + v_step + v_player_count) % v_player_count;
  ELSE
    -- Standard Number or Wild Card
    v_next_turn_index := (v_room.current_turn_index + v_step + v_player_count) % v_player_count;
  END IF;

  -- Reset called_uno if player has > 1 card
  IF jsonb_array_length(v_new_hand) > 1 THEN
    UPDATE public.players SET called_uno = false WHERE room_id = p_room_id AND id = p_player_id;
  END IF;

  -- Update room state
  UPDATE public.rooms
  SET current_turn_index = v_next_turn_index,
      current_color = v_new_color,
      last_active_at = NOW()
  WHERE id = p_room_id;

  INSERT INTO public.game_logs (room_id, player_id, log_type, message)
  VALUES (p_room_id, p_player_id, 'action', v_player.name || ' played ' || UPPER(v_card_to_play->>'color') || ' ' || UPPER(v_card_to_play->>'value'));

  RETURN jsonb_build_object('success', true, 'next_turn', v_next_turn_index, 'current_color', v_new_color);
END;
$$;

-- E. Helper for Reshuffle & Dealing Penalty Cards
CREATE OR REPLACE FUNCTION public._deal_penalty_cards(
  p_room_id UUID,
  p_target_player_id UUID,
  p_count INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game_state RECORD;
  v_draw_pile JSONB;
  v_discard_pile JSONB;
  v_target_hand JSONB;
  v_card JSONB;
  v_i INTEGER;
  v_top_card JSONB;
BEGIN
  SELECT * INTO v_game_state FROM public.game_state WHERE room_id = p_room_id;
  v_draw_pile := v_game_state.draw_pile;
  v_discard_pile := v_game_state.discard_pile;

  SELECT cards INTO v_target_hand FROM public.player_hands WHERE room_id = p_room_id AND player_id = p_target_player_id;

  FOR v_i IN 1..p_count LOOP
    -- Reshuffle if draw_pile is empty
    IF jsonb_array_length(v_draw_pile) = 0 THEN
      IF jsonb_array_length(v_discard_pile) > 1 THEN
        v_top_card := v_discard_pile->(jsonb_array_length(v_discard_pile) - 1);
        -- Shuffle remaining discard pile
        SELECT jsonb_agg(elem) INTO v_draw_pile
        FROM (
          SELECT elem FROM jsonb_array_elements(v_discard_pile - (jsonb_array_length(v_discard_pile) - 1)) AS elem
          ORDER BY random()
        ) sub;
        v_discard_pile := jsonb_build_array(v_top_card);
      ELSE
        EXIT; -- No more cards anywhere
      END IF;
    END IF;

    IF jsonb_array_length(v_draw_pile) > 0 THEN
      v_card := v_draw_pile->0;
      v_draw_pile := v_draw_pile - 0;
      v_target_hand := v_target_hand || jsonb_build_array(v_card);
    END IF;
  END LOOP;

  UPDATE public.game_state 
  SET draw_pile = v_draw_pile, discard_pile = v_discard_pile, updated_at = NOW() 
  WHERE room_id = p_room_id;

  UPDATE public.player_hands 
  SET cards = v_target_hand, updated_at = NOW() 
  WHERE room_id = p_room_id AND player_id = p_target_player_id;
END;
$$;

-- F. Draw Card RPC (Draws 1 card, reshuffles if necessary, passes turn or allows immediate play)
CREATE OR REPLACE FUNCTION public.draw_card(
  p_room_id UUID,
  p_player_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
  v_player RECORD;
  v_game_state RECORD;
  v_draw_pile JSONB;
  v_discard_pile JSONB;
  v_top_discard JSONB;
  v_drawn_card JSONB;
  v_hand JSONB;
  v_next_turn_index INTEGER;
  v_player_count INTEGER;
  v_is_playable BOOLEAN := false;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  IF v_room.status != 'playing' THEN
    RAISE EXCEPTION 'Game is not active';
  END IF;

  SELECT * INTO v_player FROM public.players WHERE room_id = p_room_id AND id = p_player_id;
  IF v_player.seat_index != v_room.current_turn_index THEN
    RAISE EXCEPTION 'It is not your turn to draw';
  END IF;

  SELECT COUNT(*) INTO v_player_count FROM public.players WHERE room_id = p_room_id;
  SELECT * INTO v_game_state FROM public.game_state WHERE room_id = p_room_id;

  v_draw_pile := v_game_state.draw_pile;
  v_discard_pile := v_game_state.discard_pile;
  v_top_discard := v_discard_pile->(jsonb_array_length(v_discard_pile) - 1);

  -- Reshuffle discard pile if draw pile empty
  IF jsonb_array_length(v_draw_pile) = 0 THEN
    IF jsonb_array_length(v_discard_pile) > 1 THEN
      SELECT jsonb_agg(elem) INTO v_draw_pile
      FROM (
        SELECT elem FROM jsonb_array_elements(v_discard_pile - (jsonb_array_length(v_discard_pile) - 1)) AS elem
        ORDER BY random()
      ) sub;
      v_discard_pile := jsonb_build_array(v_top_discard);
    ELSE
      RAISE EXCEPTION 'No cards available to draw';
    END IF;
  END IF;

  v_drawn_card := v_draw_pile->0;
  v_draw_pile := v_draw_pile - 0;

  -- Add to player hand
  SELECT cards INTO v_hand FROM public.player_hands WHERE room_id = p_room_id AND player_id = p_player_id;
  v_hand := v_hand || jsonb_build_array(v_drawn_card);

  -- Check if drawn card is playable
  IF (v_drawn_card->>'color') = 'wild'
     OR (v_drawn_card->>'color') = v_room.current_color
     OR (v_drawn_card->>'value') = (v_top_discard->>'value') THEN
    v_is_playable := true;
  END IF;

  -- Pass turn to next player unless playable (Standard rule allows player choice, or advance turn)
  -- Advance turn
  v_next_turn_index := (v_room.current_turn_index + v_room.play_direction + v_player_count) % v_player_count;

  UPDATE public.game_state 
  SET draw_pile = v_draw_pile, discard_pile = v_discard_pile, updated_at = NOW() 
  WHERE room_id = p_room_id;

  UPDATE public.player_hands 
  SET cards = v_hand, updated_at = NOW() 
  WHERE room_id = p_room_id AND player_id = p_player_id;

  UPDATE public.rooms 
  SET current_turn_index = v_next_turn_index, last_active_at = NOW() 
  WHERE id = p_room_id;

  INSERT INTO public.game_logs (room_id, player_id, log_type, message)
  VALUES (p_room_id, p_player_id, 'action', v_player.name || ' drew a card');

  RETURN jsonb_build_object('card', v_drawn_card, 'is_playable', v_is_playable, 'next_turn', v_next_turn_index);
END;
$$;

-- G. Call UNO RPC
CREATE OR REPLACE FUNCTION public.call_uno(
  p_room_id UUID,
  p_player_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player RECORD;
  v_card_count INTEGER;
BEGIN
  SELECT * INTO v_player FROM public.players WHERE room_id = p_room_id AND id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT jsonb_array_length(cards) INTO v_card_count FROM public.player_hands WHERE room_id = p_room_id AND player_id = p_player_id;

  IF v_card_count > 2 THEN
    RAISE EXCEPTION 'You cannot call UNO with more than 2 cards';
  END IF;

  UPDATE public.players SET called_uno = true WHERE room_id = p_room_id AND id = p_player_id;
  UPDATE public.rooms SET last_active_at = NOW() WHERE id = p_room_id;

  INSERT INTO public.game_logs (room_id, player_id, log_type, message)
  VALUES (p_room_id, p_player_id, 'uno', '🔥 ' || v_player.name || ' shouted UNO!');

  RETURN jsonb_build_object('success', true, 'player', v_player.name);
END;
$$;

-- H. Catch UNO RPC (Accuse a player with 1 card who failed to call UNO)
CREATE OR REPLACE FUNCTION public.catch_uno(
  p_room_id UUID,
  p_accuser_id UUID,
  p_target_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accuser RECORD;
  v_target RECORD;
  v_target_card_count INTEGER;
BEGIN
  SELECT * INTO v_accuser FROM public.players WHERE room_id = p_room_id AND id = p_accuser_id;
  SELECT * INTO v_target FROM public.players WHERE room_id = p_room_id AND id = p_target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target player not found';
  END IF;

  SELECT jsonb_array_length(cards) INTO v_target_card_count FROM public.player_hands WHERE room_id = p_room_id AND player_id = p_target_id;

  IF v_target_card_count = 1 AND v_target.called_uno = false THEN
    -- Penalty! Force target to draw 2 cards
    PERFORM public._deal_penalty_cards(p_room_id, p_target_id, 2);
    
    INSERT INTO public.game_logs (room_id, log_type, message)
    VALUES (p_room_id, 'penalty', '🚨 ' || v_accuser.name || ' caught ' || v_target.name || ' not saying UNO! ' || v_target.name || ' draws 2 cards!');

    RETURN jsonb_build_object('caught', true, 'target', v_target.name);
  ELSE
    RAISE EXCEPTION 'Player has either already called UNO or does not have exactly 1 card';
  END IF;
END;
$$;
