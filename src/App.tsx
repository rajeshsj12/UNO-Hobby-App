import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUnoGame } from './hooks/useUnoGame';
import { GameTable } from './components/GameTable';
import { PlayerHand } from './components/PlayerHand';
import { LobbyView } from './components/LobbyView';
import { WinnerModal } from './components/WinnerModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { GameLogDrawer } from './components/GameLogDrawer';
import { SqlSchemaViewer } from './components/SqlSchemaViewer';
import { NextJsCodeViewer } from './components/NextJsCodeViewer';
import { soundFx } from './lib/audio';
import { calculateDecksNeeded } from './lib/deckMath';
import {
  Volume2,
  VolumeX,
  Database,
  Code,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function App() {
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showNextJsModal, setShowNextJsModal] = useState(false);
  const [quickPlayerCount, setQuickPlayerCount] = useState(4);

  const toggleSound = () => {
    soundFx.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
  };

  // Quick Start Game with Bots (Instant Play test for up to 20 players)
  const handleQuickPlayWithBots = (botCount: number) => {
    const name = inputName.trim() || 'Champion';
    createRoom(name);
    // After creating, automatically add bots and start
    setTimeout(() => {
      for (let i = 0; i < botCount - 1; i++) {
        addBot();
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans relative overflow-x-hidden">
      {/* 1. TOP NAVBAR */}
      <header className="w-full bg-slate-900/60 border-b border-slate-800 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-4">
          {/* Logo Badge */}
          <div
            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-black tracking-widest uppercase cursor-pointer select-none shadow-md"
            onClick={() => !snapshot && leaveRoom()}
          >
            UNO MULTIPLAYER
          </div>

          {/* Room Code Indicator (when in room) */}
          {snapshot?.room ? (
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter leading-tight">
                Room Code
              </span>
              <span className="text-base sm:text-lg font-mono font-bold leading-none text-blue-400">
                {snapshot.room.room_code}
              </span>
            </div>
          ) : (
            <span className="text-[11px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700 hidden sm:inline">
              Max 20 Players
            </span>
          )}
        </div>

        {/* Center Live Game Info (When Game is Active) */}
        {snapshot?.room && snapshot.room.status === 'playing' && (
          <div className="hidden md:flex items-center gap-8">
            {/* Current Turn */}
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Current Turn
              </div>
              <div className="text-sm font-bold flex items-center gap-2 text-slate-100">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>
                  {snapshot.players.find((p) => p.seat_index === snapshot.room.current_turn_index)?.name || 'Player'}
                  {snapshot.players.find((p) => p.seat_index === snapshot.room.current_turn_index)?.id === playerId && ' (You)'}
                </span>
              </div>
            </div>

            {/* Play Direction */}
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Direction
              </div>
              <div className="text-sm font-bold text-yellow-500">
                {snapshot.room.play_direction === 1 ? 'Clockwise ↻' : 'Counter-Clockwise ↺'}
              </div>
            </div>
          </div>
        )}

        {/* Action Controls & Documentation Links */}
        <div className="flex items-center gap-3">
          {/* Active Players Counter (when in room) */}
          {snapshot?.players && (
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                Active Players
              </div>
              <div className="text-sm font-bold text-slate-100">
                {snapshot.players.length} / 20
              </div>
            </div>
          )}

          {/* Player ME Avatar Icon */}
          <div
            className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center font-bold text-xs text-white shadow"
            title={`Your Player ID: ${playerId}`}
          >
            ME
          </div>

          {/* SQL Schema Button */}
          <button
            id="btn-open-sql-schema"
            onClick={() => setShowSqlModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            title="View Supabase Postgres Schema & RPC functions"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Supabase SQL</span>
          </button>

          {/* Next.js Code Button */}
          <button
            id="btn-open-nextjs-code"
            onClick={() => setShowNextJsModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            title="View Next.js (App Router) Frontend Code"
          >
            <Code className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden lg:inline">Next.js Code</span>
          </button>

          {/* Sound Toggle */}
          <button
            id="btn-toggle-sound"
            onClick={toggleSound}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </header>

      {/* 2. TOAST NOTIFICATIONS */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-black text-xs sm:text-sm px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-yellow-300"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. ERROR BANNER */}
      {error && (
        <div className="max-w-md mx-auto mt-4 px-4 py-2 bg-red-900/60 border border-red-500 text-red-200 text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
        </div>
      )}

      {/* 4. MAIN VIEW LOGIC */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 w-full">
        {/* CASE A: No Active Room -> Landing / Create / Join */}
        {!snapshot || !currentRoomCode ? (
          <div className="w-full max-w-xl flex flex-col items-center my-auto py-6">
            {/* Uno Banner Cards Art */}
            <div className="flex items-center justify-center -space-x-4 mb-4 select-none">
              <div className="w-14 h-20 rounded-xl bg-red-500 border-2 border-white shadow-xl -rotate-12 flex items-center justify-center font-black text-white text-lg">
                7
              </div>
              <div className="w-14 h-20 rounded-xl bg-blue-500 border-2 border-white shadow-xl rotate-0 flex items-center justify-center font-black text-white text-lg z-10">
                ⊘
              </div>
              <div className="w-14 h-20 rounded-xl bg-amber-400 border-2 border-white shadow-xl rotate-12 flex items-center justify-center font-black text-slate-900 text-lg">
                +2
              </div>
              <div className="w-14 h-20 rounded-xl bg-slate-900 border-2 border-white shadow-xl rotate-25 flex items-center justify-center font-black text-white text-xs z-20">
                WILD
              </div>
            </div>

            <div className="text-center mb-6">
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Play Uno <span className="bg-gradient-to-r from-red-500 via-amber-400 to-blue-500 bg-clip-text text-transparent">Multiplayer</span>
              </h1>
              <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                Real-time multiplayer Uno engine supporting up to <strong>20 simultaneous players</strong> with dynamic deck scaling, cookie-based session resilience, and complete Postgres RPCs.
              </p>
            </div>

            {/* Room Creation & Join Card */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
              {/* Nickname Input */}
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Your Nickname
                </label>
                <input
                  id="input-player-name"
                  type="text"
                  value={inputName}
                  onChange={(e) => {
                    setInputName(e.target.value);
                    setPlayerName(e.target.value);
                  }}
                  placeholder="Enter your name"
                  maxLength={20}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                />
              </div>

              {/* Action 1: Create New Room */}
              <div className="space-y-4">
                <motion.button
                  id="btn-create-room"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                  onClick={() => createRoom(inputName.trim() || 'Player')}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 hover:opacity-95 text-white font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create New Room (Up to 20 Players)</span>
                </motion.button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">or join existing</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                {/* Join Code Input */}
                <div className="flex gap-2">
                  <input
                    id="input-room-code"
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="ENTER 4-LETTER CODE"
                    className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-center tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  />
                  <button
                    id="btn-join-room"
                    disabled={!inputCode.trim() || loading}
                    onClick={() => joinRoom(inputCode, inputName.trim() || 'Player')}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Play test feature (instant test 20 players) */}
              <div className="mt-6 pt-5 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Instant Solo Test (Add AI Bots)</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {quickPlayerCount} Players ({calculateDecksNeeded(quickPlayerCount)} Deck)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 flex gap-1.5">
                    {[2, 4, 8, 12, 20].map((count) => (
                      <button
                        key={count}
                        onClick={() => setQuickPlayerCount(count)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
                          quickPlayerCount === count
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {count}p
                      </button>
                    ))}
                  </div>
                  <button
                    id="btn-quick-play-bots"
                    onClick={() => handleQuickPlayWithBots(quickPlayerCount)}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40 text-xs font-bold px-3.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    <span>Launch</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Feature Highlights Footer */}
            <div className="grid grid-cols-3 gap-3 w-full mt-6 text-center text-xs text-slate-400">
              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <span className="font-bold text-slate-300">RLS Privacy</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Private hands protected</p>
              </div>
              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
                <Users className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <span className="font-bold text-slate-300">20-Player Math</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Auto-scaled decks</p>
              </div>
              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
                <Sparkles className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <span className="font-bold text-slate-300">UNO & Catch</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Rule enforcement</p>
              </div>
            </div>
          </div>
        ) : snapshot.room.status === 'waiting' ? (
          /* CASE B: Room Waiting Lobby */
          <LobbyView
            room={snapshot.room}
            players={snapshot.players}
            myPlayerId={playerId}
            onStartGame={startGame}
            onAddBot={addBot}
            onLeaveRoom={leaveRoom}
          />
        ) : (
          /* CASE C: Active Playing Game Table */
          <div className="w-full flex-1 flex flex-col justify-between max-w-6xl mx-auto">
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
              isMyTurn={
                snapshot.players.find((p) => p.id === playerId)?.seat_index ===
                snapshot.room.current_turn_index
              }
              onPlayCard={playCard}
              onDrawCard={drawCard}
              onCallUno={callUno}
              hasCalledUno={snapshot.players.find((p) => p.id === playerId)?.called_uno || false}
              drawPileCount={snapshot.draw_pile_count}
              onCatchUno={catchUno}
              vulnerableOpponentId={
                snapshot.players.find(
                  (p) => p.id !== playerId && p.card_count === 1 && !p.called_uno
                )?.id || null
              }
            />
          </div>
        )}
      </main>

      {/* 5. MODALS & DRAWERS */}
      {/* Wild Color Selection Modal */}
      <ColorPickerModal
        isOpen={!!wildCardPending}
        card={wildCardPending}
        onSelectColor={(color) => {
          if (wildCardPending) {
            playCard(wildCardPending, color);
          }
        }}
        onCancel={() => setWildCardPending(null)}
      />

      {/* Win Celebration Modal */}
      {snapshot && (
        <WinnerModal
          winnerId={snapshot.room.winner_id || null}
          players={snapshot.players}
          myPlayerId={playerId}
          isHost={snapshot.players.find((p) => p.id === playerId)?.is_host || false}
          onPlayAgain={restartGame}
          onLeave={leaveRoom}
        />
      )}

      {/* Live Event Logs Drawer */}
      {snapshot && <GameLogDrawer logs={snapshot.logs} />}

      {/* Supabase SQL Schema Viewer Modal */}
      <SqlSchemaViewer isOpen={showSqlModal} onClose={() => setShowSqlModal(false)} />

      {/* Next.js Code Viewer Modal */}
      <NextJsCodeViewer isOpen={showNextJsModal} onClose={() => setShowNextJsModal(false)} />
    </div>
  );
}
