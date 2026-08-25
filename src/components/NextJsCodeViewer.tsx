import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code, Copy, Check, X, FileText } from 'lucide-react';

interface NextJsCodeViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const NEXTJS_PAGE_CODE = `// app/page.tsx - Next.js (App Router) Multiplayer Uno Game
'use client';

import React, { useState } from 'react';
import { useUnoGame } from '@/hooks/useUnoGame';
import { GameTable } from '@/components/GameTable';
import { PlayerHand } from '@/components/PlayerHand';
import { LobbyView } from '@/components/LobbyView';
import { WinnerModal } from '@/components/WinnerModal';
import { ColorPickerModal } from '@/components/ColorPickerModal';
import { GameLogDrawer } from '@/components/GameLogDrawer';

export default function UnoGamePage() {
  const {
    playerId,
    playerName,
    setPlayerName,
    currentRoomCode,
    snapshot,
    loading,
    error,
    toastMessage,
    wildCardPending,
    setWildCardPending,
    createRoom,
    joinRoom,
    addBot,
    startGame,
    playCard,
    drawCard,
    callUno,
    catchUno,
    restartGame,
    leaveRoom,
  } = useUnoGame();

  const [inputName, setInputName] = useState(playerName || '');
  const [inputCode, setInputCode] = useState('');

  // 1. Landing Screen (Create / Join Room)
  if (!snapshot || !currentRoomCode) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-3xl font-black text-center text-white mb-2">
            Multiplayer <span className="text-red-500">U</span><span className="text-blue-500">N</span><span className="text-amber-400">O</span>
          </h1>
          <p className="text-xs text-center text-slate-400 mb-6">
            Supports up to 20 players with dynamic deck scaling
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300">Your Nickname</label>
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Enter player name"
                className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm"
              />
            </div>

            <button
              onClick={() => createRoom(inputName || 'Host')}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 font-bold rounded-xl text-white text-sm shadow-lg cursor-pointer"
            >
              + Create New Room (Up to 20 Players)
            </button>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="Room Code"
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm font-mono text-center"
              />
              <button
                onClick={() => joinRoom(inputCode, inputName || 'Player')}
                disabled={!inputCode || loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm cursor-pointer"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // 2. Waiting Room Lobby
  if (snapshot.room.status === 'waiting') {
    return (
      <LobbyView
        room={snapshot.room}
        players={snapshot.players}
        myPlayerId={playerId}
        onStartGame={startGame}
        onAddBot={addBot}
        onLeaveRoom={leaveRoom}
      />
    );
  }

  // 3. Active Playing Table
  const myPlayer = snapshot.players.find((p) => p.id === playerId);
  const isMyTurn = myPlayer ? snapshot.room.current_turn_index === myPlayer.seat_index : false;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between">
      <GameTable
        snapshot={snapshot}
        onPlayCard={playCard}
        onDrawCard={drawCard}
        onCatchUno={catchUno}
      />
      <PlayerHand
        cards={snapshot.my_hand}
        currentColor={snapshot.room.current_color}
        topCard={snapshot.top_card}
        isMyTurn={isMyTurn}
        onPlayCard={playCard}
        onDrawCard={drawCard}
        onCallUno={callUno}
        hasCalledUno={myPlayer?.called_uno || false}
        drawPileCount={snapshot.draw_pile_count}
      />
      <ColorPickerModal
        isOpen={!!wildCardPending}
        card={wildCardPending}
        onSelectColor={(c) => wildCardPending && playCard(wildCardPending, c)}
        onCancel={() => setWildCardPending(null)}
      />
      <WinnerModal
        winnerId={snapshot.room.winner_id || null}
        players={snapshot.players}
        myPlayerId={playerId}
        isHost={myPlayer?.is_host || false}
        onPlayAgain={restartGame}
        onLeave={leaveRoom}
      />
      <GameLogDrawer logs={snapshot.logs} />
    </div>
  );
}
`;

export const NextJsCodeViewer: React.FC<NextJsCodeViewerProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(NEXTJS_PAGE_CODE);
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
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Next.js (App Router) Frontend Code</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Client resilience, anonymous cookie session recovery, and Framer Motion layout
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

          {/* Copy Bar */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900 border-b border-slate-800">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="font-mono text-slate-300">app/page.tsx</span>
            </div>
            <button
              id="btn-copy-nextjs-code"
              onClick={handleCopy}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'Copied Next.js Code!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Code Body */}
          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-700 font-mono text-xs">
            <pre className="bg-slate-950 p-4 rounded-xl text-slate-300 leading-relaxed overflow-x-auto border border-slate-800 whitespace-pre">
              {NEXTJS_PAGE_CODE}
            </pre>
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
