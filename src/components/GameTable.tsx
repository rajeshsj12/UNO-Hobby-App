import React from 'react';
import { FullGameSnapshot, UnoCard } from '../types';
import { UnoCardView } from './UnoCardView';
import { PlayerAvatar } from './PlayerAvatar';
import { getColorClass } from '../lib/deckMath';
import { Flame } from 'lucide-react';

interface GameTableProps {
  snapshot: FullGameSnapshot;
  onPlayCard: (card: UnoCard) => void;
  onDrawCard: () => void;
  onCatchUno: (targetId: string) => void;
}

export const GameTable: React.FC<GameTableProps> = ({
  snapshot,
  onDrawCard,
  onCatchUno,
}) => {
  const { room, players, top_card, draw_pile_count, my_player_id } = snapshot;

  const otherPlayers = players.filter((p) => p.id !== my_player_id);
  const myPlayer = players.find((p) => p.id === my_player_id);
  const isMyTurn = myPlayer ? room.current_turn_index === myPlayer.seat_index : false;
  const activeColorStyle = getColorClass(room.current_color);

  return (
    <div className="relative w-full flex-1 flex flex-col items-center justify-between min-h-[380px] max-w-5xl mx-auto px-4 select-none py-2">
      {/* 1. Top Other Players Orbit (Up to 19 Players) */}
      <div className="w-full flex justify-center">
        <div className="flex flex-wrap justify-center gap-2 max-w-[900px] mx-auto max-h-32 sm:max-h-36 overflow-y-auto px-2 py-1 scrollbar-thin scrollbar-thumb-slate-700">
          {otherPlayers.map((player) => (
            <PlayerAvatar
              key={player.id}
              player={player}
              isCurrentTurn={room.current_turn_index === player.seat_index}
              onCatchUno={onCatchUno}
              canCatch={player.card_count === 1 && !player.called_uno}
            />
          ))}
        </div>
      </div>

      {/* 2. Central Table Stage: Draw Pile & Discard Pile */}
      <div className="my-auto py-4 flex gap-10 sm:gap-16 items-center justify-center">
        {/* DRAW PILE (Clickable on player turn) */}
        <div
          id="btn-draw-pile"
          onClick={isMyTurn ? onDrawCard : undefined}
          className={`relative group cursor-pointer select-none transition-transform ${
            isMyTurn ? 'hover:scale-105 active:scale-95' : 'opacity-90'
          }`}
        >
          <div className="w-28 h-42 sm:w-32 sm:h-48 bg-slate-800 border-4 border-white rounded-xl shadow-2xl flex items-center justify-center relative transform -rotate-6">
            <div className="w-20 h-30 sm:w-24 sm:h-36 bg-red-600 rounded-lg flex items-center justify-center font-black text-3xl sm:text-4xl italic tracking-tighter text-white select-none shadow-inner border border-red-400/50">
              UNO
            </div>
          </div>
          <div className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 bg-blue-600 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full shadow-lg border border-blue-400">
            DRAW PILE ({draw_pile_count})
          </div>
        </div>

        {/* DISCARD PILE (Top Card + Active Playable Color Pill) */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative transform rotate-2">
            {top_card ? (
              <UnoCardView card={top_card} size="md" isPlayable={false} />
            ) : (
              <div className="w-28 h-42 sm:w-32 sm:h-48 rounded-xl border-4 border-dashed border-slate-700 flex items-center justify-center text-slate-600 text-xs">
                Empty
              </div>
            )}
          </div>

          {/* Active Playable Color Badge */}
          <div
            className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border shadow-md ${activeColorStyle.pill}`}
          >
            {room.current_color} Playable
          </div>
        </div>
      </div>

      {/* 3. UNO Shout Floating Alert */}
      {players.some((p) => p.card_count === 1 && p.called_uno) && (
        <div className="bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs px-4 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce mb-1 border border-yellow-300">
          <Flame className="w-4 h-4 text-yellow-300" />
          <span>UNO DECLARED ON TABLE!</span>
        </div>
      )}
    </div>
  );
};
