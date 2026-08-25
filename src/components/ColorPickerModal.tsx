import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CardColor, UnoCard } from '../types';
import { UnoCardView } from './UnoCardView';

interface ColorPickerModalProps {
  isOpen: boolean;
  card: UnoCard | null;
  onSelectColor: (color: CardColor) => void;
  onCancel: () => void;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  card,
  onSelectColor,
  onCancel,
}) => {
  if (!isOpen || !card) return null;

  const colors: { name: CardColor; label: string; bg: string; ring: string; shadow: string }[] = [
    { name: 'red', label: 'RED', bg: 'bg-red-500 hover:bg-red-600', ring: 'focus:ring-red-400', shadow: 'shadow-red-500/50' },
    { name: 'blue', label: 'BLUE', bg: 'bg-blue-500 hover:bg-blue-600', ring: 'focus:ring-blue-400', shadow: 'shadow-blue-500/50' },
    { name: 'green', label: 'GREEN', bg: 'bg-emerald-500 hover:bg-emerald-600', ring: 'focus:ring-emerald-400', shadow: 'shadow-emerald-500/50' },
    { name: 'yellow', label: 'YELLOW', bg: 'bg-amber-400 hover:bg-amber-500 text-slate-950', ring: 'focus:ring-amber-300', shadow: 'shadow-amber-400/50' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center relative overflow-hidden"
        >
          {/* Subtle felt glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="flex justify-center mb-4">
            <UnoCardView card={card} size="md" isPlayable={false} />
          </div>

          <h3 className="text-xl font-black text-white tracking-wide uppercase">
            Choose Next Color
          </h3>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Pick which color other players must follow
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {colors.map((c) => (
              <motion.button
                key={c.name}
                id={`btn-select-color-${c.name}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectColor(c.name)}
                className={`py-4 rounded-xl font-black text-lg text-white shadow-lg transition-all duration-150 cursor-pointer border-2 border-white/20 ${c.bg} ${c.shadow}`}
              >
                {c.label}
              </motion.button>
            ))}
          </div>

          <button
            onClick={onCancel}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 mt-2 cursor-pointer transition-colors"
          >
            Cancel & Keep in Hand
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
