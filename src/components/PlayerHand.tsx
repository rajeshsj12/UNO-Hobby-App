import React from 'react';
import { motion } from 'motion/react';
import { CardColor, UnoCard } from '../types';
import { UnoCardView } from './UnoCardView';
import { isCardPlayable } from '../lib/deckMath';
import { PlusCircle } from 'lucide-react';

interface PlayerHandProps {
  cards: UnoCard[];
  currentColor: CardColor;
  topCard: UnoCard | null;
  isMyTurn: boolean;
  onPlayCard: (card: UnoCard) => void;
  onDrawCard: () => void;
  onCallUno: () => void;
  hasCalledUno: boolean;
  drawPileCount: number;
  onCatchUno?: (targetId: string) => void;
  vulnerableOpponentId?: string | null;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  currentColor,
  topCard,
  isMyTurn,
  onPlayCard,
  onDrawCard,
  onCallUno,
  hasCalledUno,
  drawPileCount,
  onCatchUno,
  vulnerableOpponentId,
}) => {
  const cardCount = cards.length;
  const canCallUno = cardCount <= 2 && !hasCalledUno;

  return (
    <div className="w-full bg-slate-900/90 border-t border-slate-800 px-4 sm:px-12 py-4 flex flex-col items-center gap-2 relative mt-auto">
      {/* Floating Action Buttons over Tray Top Edge */}
      <div className="absolute -top-5 sm:-top-6 right-4 sm:right-12 flex items-center gap-3 z-30">
        {/* CATCH! Penalty Button */}
        {vulnerableOpponentId && onCatchUno && (
          <button
            id="btn-floating-catch-uno"
            onClick={() => onCatchUno(vulnerableOpponentId)}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 sm:py-2.5 px-5 sm:px-7 rounded-full border-2 border-slate-600 shadow-xl text-xs sm:text-sm transition-colors cursor-pointer active:scale-95 animate-bounce"
          >
            CATCH!
          </button>
        )}

        {/* Quick Draw Button */}
        {isMyTurn && (
          <button
            id="btn-hand-draw-card"
            onClick={onDrawCard}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold py-2 sm:py-2.5 px-4 sm:px-5 rounded-full border border-slate-600 shadow-lg text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>Draw 1 ({drawPileCount})</span>
          </button>
        )}

        {/* Big Vibrant UNO! Button */}
        <button
          id="btn-floating-uno"
          onClick={onCallUno}
          disabled={hasCalledUno}
          className={`font-black py-2 sm:py-2.5 px-6 sm:px-10 rounded-full border-4 border-white shadow-[0_0_20px_rgba(220,38,38,0.5)] text-base sm:text-xl italic transition-all cursor-pointer uppercase select-none ${
            hasCalledUno
              ? 'bg-emerald-600 text-white opacity-80 cursor-default'
              : canCallUno
              ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse active:scale-95 shadow-red-600/80 ring-4 ring-yellow-400'
              : 'bg-red-700 hover:bg-red-600 text-white active:scale-95'
          }`}
        >
          {hasCalledUno ? 'UNO! ✓' : 'UNO!'}
        </button>
      </div>

      {/* Subtitle / Turn & Hand Count Info */}
      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
        <span>Your Hand — {cardCount} Cards</span>
        {isMyTurn && (
          <span className="bg-yellow-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black tracking-normal">
            YOUR TURN
          </span>
        )}
      </div>

      {/* Cards Fan Container */}
      <div className="w-full flex justify-center overflow-x-auto py-2 px-4 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="flex justify-center -space-x-8 sm:-space-x-12 mt-1 px-8 py-2 min-h-[170px]">
          {cards.map((card, index) => {
            const playable = isMyTurn && isCardPlayable(card, currentColor, topCard);

            return (
              <motion.div
                key={card.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.2) }}
                className="relative z-10 hover:z-40 transition-all"
              >
                <UnoCardView
                  card={card}
                  size="lg"
                  isPlayable={playable}
                  onClick={() => onPlayCard(card)}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
