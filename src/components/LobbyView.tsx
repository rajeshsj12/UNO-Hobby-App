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
  Crown,
  ShieldCheck,
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
  const hostPlayer = players.find((p) => p.is_host);
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
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs uppercase px-3 py-1 rounded-full shadow-md mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Super Peaks UNO 20 20 Lobby</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Room Code:{' '}
          <span className="text-amber-400 font-mono tracking-widest">{room.room_code}</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Share this code or link with friends to play with up to 20 players
        </p>

        {/* Copy Actions */}
        <div className="flex items-center justify-center gap-2 mt-3">
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

      {/* 👑 PROMINENT ROOM OWNER BANNER */}
      <div className="w-full max-w-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-2 border-amber-400/50 rounded-2xl p-4 mb-5 shadow-xl flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/30">
            <Crown className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/40">
                👑 Room Owner & Host
              </span>
              {hostPlayer?.id === myPlayerId && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30">
                  You
                </span>
              )}
            </div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5 flex items-center gap-2">
              <span>{hostPlayer?.name || 'Room Host'}</span>
              <span className="text-xs font-mono text-slate-400 font-normal">
                (Seat {hostPlayer ? hostPlayer.seat_index + 1 : 1})
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active</span>
          </span>
        </div>
      </div>

      {/* Info Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-xl mb-5">
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

      {/* 👥 ACTIVE PLAYERS ROSTER */}
      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Joined Players ({playerCount} of 20)</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {playerCount >= 2 ? '✅ Ready to start' : '⏳ Need at least 2 players'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
          {players.map((p) => {
            const isMe = p.id === myPlayerId;
            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  p.is_host
                    ? 'bg-amber-500/10 border-amber-400/50 ring-1 ring-amber-400/30'
                    : isMe
                    ? 'bg-blue-500/10 border-blue-400/40 ring-1 ring-blue-400/20'
                    : 'bg-slate-800/80 border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow ${
                      p.is_host
                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black shadow-amber-500/20'
                        : p.is_bot
                        ? 'bg-blue-600 text-white shadow-blue-500/20'
                        : isMe
                        ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {p.is_host ? (
                      <Crown className="w-4 h-4 fill-current" />
                    ) : p.is_bot ? (
                      <Bot className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-100 text-xs truncate flex items-center gap-1.5">
                      <span className="truncate">{p.name}</span>
                      {p.is_host && (
                        <span className="bg-amber-400/25 text-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded border border-amber-400/40 shrink-0">
                          HOST
                        </span>
                      )}
                      {isMe && (
                        <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-1.5 py-0.2 rounded border border-emerald-400/30 shrink-0">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Seat {p.seat_index + 1}</span>
                      <span>•</span>
                      <span>{p.is_bot ? 'AI Bot' : 'Player'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Connected" />
                  <span className="text-[10px] font-semibold text-slate-400">Ready</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 20-Seat Compact Visual Grid */}
      <div className="w-full max-w-xl bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-6 shadow-md">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Table Seats (20 Player Capacity)</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {20 - playerCount} open seats remaining
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
          {Array.from({ length: 20 }).map((_, seatIdx) => {
            const playerAtSeat = players.find((p) => p.seat_index === seatIdx);
            const isMe = playerAtSeat?.id === myPlayerId;

            return (
              <div
                key={seatIdx}
                title={playerAtSeat ? `${playerAtSeat.name} (Seat ${seatIdx + 1})` : `Seat ${seatIdx + 1} (Empty)`}
                className={`p-1.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center min-h-[46px] ${
                  playerAtSeat
                    ? playerAtSeat.is_host
                      ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 font-bold'
                      : isMe
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 font-bold'
                      : 'bg-blue-600/20 border-blue-500/40 text-blue-200'
                    : 'bg-slate-950/30 border-dashed border-slate-800 text-slate-600'
                }`}
              >
                <div className="text-[9px] font-mono opacity-60">#{seatIdx + 1}</div>
                {playerAtSeat ? (
                  <div className="text-[9px] font-black truncate max-w-full leading-tight">
                    {playerAtSeat.is_host ? '👑' : playerAtSeat.is_bot ? '🤖' : '👤'}
                  </div>
                ) : (
                  <div className="text-[8px] text-slate-600 leading-tight">-</div>
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
                <span>+ Add Bot</span>
              </button>
            )}
          </>
        ) : (
          <div className="text-center p-4 bg-slate-900 border border-slate-800 rounded-xl w-full">
            <div className="text-sm font-semibold text-amber-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Waiting for Room Owner ({hostPlayer?.name || 'Host'}) to start the game...</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              The game will automatically deal cards to all {playerCount} players when the host starts.
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
