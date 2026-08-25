import React from 'react';
import { motion } from 'motion/react';
import { UnoCard } from '../types';
import { formatCardLabel, getColorClass } from '../lib/deckMath';

interface UnoCardViewProps {
  card: UnoCard;
  isPlayable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'mini';
  faceDown?: boolean;
  className?: string;
  isStacked?: boolean;
}

export const UnoCardView: React.FC<UnoCardViewProps> = ({
  card,
  isPlayable = false,
  onClick,
  size = 'md',
  faceDown = false,
  className = '',
}) => {
  const colorStyle = getColorClass(card.color);
  const label = formatCardLabel(card.value);

  // Sizing definitions
  const sizeClasses = {
    mini: 'w-10 h-14 rounded-md text-xs',
    sm: 'w-14 h-20 rounded-lg text-sm',
    md: 'w-32 h-48 rounded-xl text-2xl border-4',
    lg: 'w-28 h-40 rounded-lg text-2xl border-2 sm:w-28 sm:h-40',
  }[size];

  // Face down design (Back of Uno Card)
  if (faceDown) {
    return (
      <div
        id={`card-back-${card.id}`}
        className={`relative select-none flex items-center justify-center bg-slate-850 border-4 border-white rounded-xl shadow-2xl overflow-hidden ${sizeClasses} ${className}`}
      >
        <div className="w-24 h-36 bg-red-600 rounded-lg flex items-center justify-center font-black text-3xl sm:text-4xl italic tracking-tighter text-white select-none shadow-inner border border-red-400/50">
          UNO
        </div>
      </div>
    );
  }

  // Wild Card multi-color badge for center
  const isWild = card.color === 'wild';

  return (
    <motion.button
      id={`card-${card.id}`}
      layout
      layoutId={`card-${card.id}`}
      whileHover={isPlayable ? { y: -24, scale: 1.05, zIndex: 30 } : { y: -2 }}
      whileTap={isPlayable ? { scale: 0.95 } : undefined}
      onClick={isPlayable ? onClick : undefined}
      disabled={!isPlayable && !onClick}
      className={`relative select-none text-left p-1.5 transition-all duration-200 cursor-pointer overflow-hidden shadow-xl shadow-black/60 ${
        colorStyle.bg
      } ${sizeClasses} ${
        isPlayable
          ? 'border-4 border-yellow-400 shadow-2xl ring-4 ring-green-500/30 -translate-y-4'
          : 'border-2 border-white'
      } ${className}`}
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Playable Badge */}
      {isPlayable && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider z-20 shadow-md">
          PLAYABLE
        </div>
      )}

      {/* Top-Left Corner Symbol */}
      <div className="absolute top-1 left-2 font-black text-white leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        <span className={size === 'md' ? 'text-lg' : 'text-sm font-black'}>{label}</span>
      </div>

      {/* Center Angled Oval */}
      <div
        className={`absolute inset-3 rounded-[50%] -rotate-45 flex items-center justify-center shadow-inner overflow-hidden ${
          isWild ? 'bg-slate-900 border-2 border-white/40' : 'bg-white'
        }`}
      >
        {isWild ? (
          <div className="w-full h-full grid grid-cols-2 grid-rows-2">
            <div className="bg-red-500" />
            <div className="bg-blue-500" />
            <div className="bg-emerald-500" />
            <div className="bg-yellow-400" />
            <div className="absolute inset-0 flex items-center justify-center rotate-45">
              <span className="font-black italic text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] text-xs sm:text-sm uppercase tracking-tighter">
                {label}
              </span>
            </div>
          </div>
        ) : (
          <span
            className={`font-black rotate-45 leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] ${colorStyle.text} ${
              size === 'md' ? 'text-5xl sm:text-6xl' : size === 'lg' ? 'text-4xl' : 'text-xl'
            }`}
          >
            {label}
          </span>
        )}
      </div>

      {/* Bottom-Right Inverted Corner Symbol */}
      <div className="absolute bottom-1 right-2 font-black text-white leading-none rotate-180 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        <span className={size === 'md' ? 'text-lg' : 'text-sm font-black'}>{label}</span>
      </div>
    </motion.button>
  );
};
