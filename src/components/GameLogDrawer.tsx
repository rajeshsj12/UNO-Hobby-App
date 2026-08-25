import React, { useState } from 'react';
import { GameLogEntry } from '../types';
import { ScrollText, ChevronUp, ChevronDown, Flame, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

interface GameLogDrawerProps {
  logs: GameLogEntry[];
}

export const GameLogDrawer: React.FC<GameLogDrawerProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getLogIcon = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'uno':
        return <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'penalty':
        return <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      case 'win':
        return <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
      case 'action':
        return <RefreshCw className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      default:
        return <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />;
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-30 max-w-sm w-full sm:w-80">
      <div className="bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden">
        {/* Header Toggle */}
        <button
          id="btn-toggle-game-log"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 bg-slate-800/80 hover:bg-slate-800 flex items-center justify-between text-xs font-bold text-slate-300 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <ScrollText className="w-4 h-4 text-amber-400" />
            <span>Game Log & Events</span>
            <span className="bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded text-[10px] font-mono">
              {logs.length}
            </span>
          </div>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {/* Log Entries Body */}
        {isOpen && (
          <div className="max-h-60 overflow-y-auto p-2.5 space-y-1.5 text-xs divide-y divide-slate-800/60 scrollbar-thin scrollbar-thumb-slate-700">
            {logs.length === 0 ? (
              <div className="text-center text-slate-500 py-3 italic">No events yet</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="pt-1.5 flex items-start gap-2">
                  <div className="mt-0.5">{getLogIcon(log.type)}</div>
                  <div className="flex-1">
                    <span
                      className={`leading-tight ${
                        log.type === 'uno'
                          ? 'text-amber-300 font-bold'
                          : log.type === 'penalty'
                          ? 'text-red-300 font-bold'
                          : log.type === 'win'
                          ? 'text-yellow-300 font-extrabold'
                          : log.type === 'action'
                          ? 'text-slate-200'
                          : 'text-slate-400'
                      }`}
                    >
                      {log.text}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
