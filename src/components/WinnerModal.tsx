import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Player } from '../types';
import { Trophy, RotateCcw, Sparkles } from 'lucide-react';

interface WinnerModalProps {
  winnerId: string | null;
  players: Player[];
  myPlayerId: string;
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({
  winnerId,
  players,
  myPlayerId,
  isHost,
  onPlayAgain,
  onLeave,
}) => {
  if (!winnerId) return null;

  const winner = players.find((p) => p.id === winnerId);
  const isMe = winnerId === myPlayerId;

  // Trigger confetti cannon
  useEffect(() => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-slate-900 border-2 border-yellow-400/60 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden"
        >
          {/* Glowing celebratory background orbs */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Trophy Icon */}
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-xl mb-4 animate-bounce">
            <Trophy className="w-10 h-10 fill-current" />
          </div>

          <div className="inline-flex items-center gap-1.5 bg-yellow-400/20 text-yellow-300 text-xs font-black uppercase px-3 py-1 rounded-full border border-yellow-400/40 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>UNO CHAMPION</span>
          </div>

          <h2 className="text-3xl font-black text-white tracking-tight">
            {isMe ? '🎉 YOU WON!' : `${winner?.name || 'Player'} Won!`}
          </h2>
          <p className="text-slate-400 text-sm mt-1 mb-6">
            {isMe
              ? 'Congratulations! You emptied your hand first and claimed victory!'
              : `${winner?.name || 'A player'} emptied their hand and claimed the crown!`}
          </p>

          {/* Players Table Standings */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-6 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">
              Final Standings
            </div>
            <div className="space-y-1.5">
              {players
                .slice()
                .sort((a, b) => (a.id === winnerId ? -1 : b.id === winnerId ? 1 : a.card_count - b.card_count))
                .map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                      p.id === winnerId
                        ? 'bg-yellow-400/15 border border-yellow-400/40 text-yellow-300 font-bold'
                        : 'bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">#{idx + 1}</span>
                      <span>{p.name}</span>
                      {p.id === myPlayerId && <span className="text-[10px] text-amber-400">(You)</span>}
                    </div>
                    <span className="font-mono">
                      {p.id === winnerId ? '🏆 0 cards' : `${p.card_count} cards left`}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isHost ? (
              <motion.button
                id="btn-play-again"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPlayAgain}
                className="w-full sm:w-auto flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm py-3 px-5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </motion.button>
            ) : (
              <div className="text-xs text-slate-400 italic mb-2">
                Waiting for host to restart game...
              </div>
            )}

            <button
              id="btn-leave-after-win"
              onClick={onLeave}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-3 px-4 rounded-xl border border-slate-700 cursor-pointer transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
