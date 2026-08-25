import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Player, Room } from '../types';
import { calculateDecksNeeded } from '../lib/deckMath';
import {
  Users,
  Copy,
  Check,
  Play,
  Bot,
  Sparkles,
  Layers,
  LogOut,
  User,
} from 'lucide-react';

interface LobbyViewProps {
  room: Room;
  players: Player[];
  myPlayerId: string;
  onStartGame: () => void;
  onAddBot: () => void;
  onLeaveRoom: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  room,
  players,
  myPlayerId,
  onStartGame,
  onAddBot,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const myPlayer = players.find((p) => p.id === myPlayerId);
  const isHost = myPlayer?.is_host || false;
  const playerCount = players.length;
  const decksNeeded = calculateDecksNeeded(playerCount);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyShareUrl = () => {
    const url = `${window.location.origin}?room=${room.room_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col items-center">
      {/* Header Banner */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs uppercase px-3 py-1 rounded-full shadow-md mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multiplayer Uno Lobby</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Room Code:{' '}
          <span className="text-amber-400 font-mono tracking-widest">{room.room_code}</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Share this code or link with friends to play with up to 20 players
        </p>

        {/* Copy Actions */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            id="btn-copy-code"
            onClick={handleCopyCode}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copied ? 'Copied Code!' : 'Copy Code'}</span>
          </button>
          <button
            id="btn-copy-link"
            onClick={handleCopyShareUrl}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>Copy Join Link</span>
          </button>
        </div>
      </div>

      {/* Info Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg mb-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400 font-medium">Players Joined</div>
          <div className="text-2xl font-black text-white mt-0.5">
            {playerCount} <span className="text-xs text-slate-500 font-normal">/ 20</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Deck Scaling</span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-0.5">
            {decksNeeded} <span className="text-xs text-slate-400 font-normal">({decksNeeded * 108} cards)</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-400 font-medium">Your Seat</div>
          <div className="text-2xl font-black text-emerald-400 mt-0.5">
            #{myPlayer ? myPlayer.seat_index + 1 : '-'}
          </div>
        </div>
      </div>

      {/* 20-Seat Visual Grid */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Table Seats (Up to 20 Players)</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {playerCount >= 2 ? '✅ Ready to start' : '⏳ Need at least 2 players'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
          {Array.from({ length: 20 }).map((_, seatIdx) => {
            const playerAtSeat = players.find((p) => p.seat_index === seatIdx);
            const isMe = playerAtSeat?.id === myPlayerId;

            return (
              <div
                key={seatIdx}
                className={`p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between min-h-[72px] ${
                  playerAtSeat
                    ? isMe
                      ? 'bg-amber-500/10 border-amber-400/50 ring-1 ring-amber-400/30'
                      : 'bg-slate-800/80 border-slate-700'
                    : 'bg-slate-950/40 border-dashed border-slate-800 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-400 font-bold">
                    Seat {seatIdx + 1}
                  </span>
                  {playerAtSeat?.is_host && (
                    <span className="bg-yellow-400/20 text-yellow-300 text-[9px] font-black px-1.5 py-0.2 rounded border border-yellow-400/40">
                      HOST
                    </span>
                  )}
                </div>

                {playerAtSeat ? (
                  <div className="mt-1">
                    <div className="font-bold text-slate-200 truncate flex items-center gap-1">
                      {playerAtSeat.is_bot ? (
                        <Bot className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span className="truncate">{playerAtSeat.name}</span>
                    </div>
                    {isMe && <div className="text-[10px] text-amber-300 font-semibold">(You)</div>}
                  </div>
                ) : (
                  <div className="text-[11px] italic text-slate-600 text-center my-auto">
                    Empty Seat
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
        {isHost ? (
          <>
            <motion.button
              id="btn-start-game"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={playerCount < 2}
              onClick={onStartGame}
              className={`w-full sm:w-auto flex-1 py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                playerCount >= 2
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Uno Game ({playerCount} Players)</span>
            </motion.button>

            {playerCount < 20 && (
              <button
                id="btn-add-bot"
                onClick={onAddBot}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 py-3.5 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow"
                title="Add an AI Bot to test up to 20 players"
              >
                <Bot className="w-4 h-4 text-blue-400" />
                <span>+ Add Bot Player</span>
              </button>
            )}
          </>
        ) : (
          <div className="text-center p-4 bg-slate-900 border border-slate-800 rounded-xl w-full">
            <div className="text-sm font-semibold text-amber-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Waiting for the host to start the game...
            </div>
            <p className="text-xs text-slate-500 mt-1">
              The game will automatically deal cards when the host starts.
            </p>
          </div>
        )}

        <button
          id="btn-leave-room"
          onClick={onLeaveRoom}
          className="w-full sm:w-auto text-slate-400 hover:text-red-400 bg-slate-900 border border-slate-800 hover:border-red-500/30 py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Leave Room</span>
        </button>
      </div>
    </div>
  );
};
