import React from 'react';
import { motion } from 'motion/react';
import { Player } from '../types';
import { ShieldAlert, Flame } from 'lucide-react';

interface PlayerAvatarProps {
  player: Player;
  isCurrentTurn: boolean;
  onCatchUno?: (targetId: string) => void;
  canCatch?: boolean;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  player,
  isCurrentTurn,
  onCatchUno,
  canCatch = false,
}) => {
  const hasOneCard = player.card_count === 1;
  const isVulnerable = hasOneCard && !player.called_uno;

  return (
    <motion.div
      id={`player-avatar-${player.id}`}
      layout
      animate={
        isCurrentTurn
          ? {
              scale: 1.05,
              boxShadow: '0 0 12px rgba(59, 130, 246, 0.6)',
            }
          : { scale: 1, boxShadow: '0px 0px 0px 0px rgba(0,0,0,0)' }
      }
      transition={{ duration: 0.2 }}
      className={`relative flex flex-col items-center p-1.5 w-20 rounded-lg transition-all duration-200 ${
        isCurrentTurn
          ? 'bg-slate-800/90 border-2 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] opacity-100'
          : 'bg-slate-800/80 border border-slate-700 opacity-70 hover:opacity-100'
      }`}
    >
      {/* Player Name */}
      <span className="text-[10px] font-bold truncate w-full text-center text-slate-200">
        {player.name}
        {player.is_host && <span className="text-yellow-400 ml-0.5">★</span>}
      </span>

      {/* Card Count Box */}
      <div
        className={`w-full rounded py-0.5 mt-1 text-center font-bold text-xs flex items-center justify-center gap-1 ${
          hasOneCard
            ? 'bg-red-950/80 border border-red-500 text-red-300 animate-pulse'
            : 'bg-slate-900 text-blue-400'
        }`}
      >
        <span>{player.card_count}</span>
        <span className="text-[10px]">🎴</span>
      </div>

      {/* UNO Called Indicator */}
      {player.called_uno && hasOneCard && (
        <div className="mt-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded px-1 py-0.2 text-[9px] font-black tracking-wider flex items-center gap-0.5">
          <Flame className="w-2.5 h-2.5 text-amber-400" />
          <span>UNO</span>
        </div>
      )}

      {/* Catch UNO Penalty Button (Appears if player has 1 card and failed to call UNO) */}
      {isVulnerable && canCatch && onCatchUno && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onCatchUno(player.id)}
          className="mt-1 w-full bg-red-600 hover:bg-red-500 text-white font-black text-[9px] py-0.5 rounded shadow flex items-center justify-center gap-0.5 border border-red-300 cursor-pointer animate-bounce"
        >
          <ShieldAlert className="w-2.5 h-2.5" />
          <span>CATCH!</span>
        </motion.button>
      )}
    </motion.div>
  );
};
