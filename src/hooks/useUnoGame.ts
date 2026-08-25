import { useState, useEffect, useCallback, useRef } from 'react';
import { FullGameSnapshot, UnoCard, CardColor } from '../types';
import { getOrCreatePlayerId, getSavedPlayerName, savePlayerName } from '../lib/cookie';
import { soundFx } from '../lib/audio';
import { unoEngine } from '../services/unoEngine';

export function useUnoGame() {
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerNameState] = useState<string>('');
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FullGameSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [wildCardPending, setWildCardPending] = useState<UnoCard | null>(null);
  const lastTurnIndex = useRef<number | null>(null);
  const lastLogsCount = useRef<number>(0);

  // Initialize UUID and saved player name from cookie
  useEffect(() => {
    const id = getOrCreatePlayerId();
    const savedName = getSavedPlayerName();
    setPlayerId(id);
    setPlayerNameState(savedName || 'Player_' + id.substring(0, 4));

    // Check URL parameters for direct room code / share link
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setCurrentRoomCode(roomParam.toUpperCase());
    }
  }, []);

  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    savePlayerName(name);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!currentRoomCode || !playerId) return;

    const unsubscribe = unoEngine.subscribe(currentRoomCode, playerId, (newSnapshot) => {
      setSnapshot(newSnapshot);

      // Play sound if turn changed to me
      if (newSnapshot.room.status === 'playing') {
        const myPlayer = newSnapshot.players.find((p) => p.id === playerId);
        if (myPlayer && myPlayer.seat_index === newSnapshot.room.current_turn_index) {
          if (lastTurnIndex.current !== newSnapshot.room.current_turn_index) {
            soundFx.playTurnAlert();
            showToast("🎯 It's YOUR TURN!");
          }
        }
        lastTurnIndex.current = newSnapshot.room.current_turn_index;
      }

      // Check for win
      if (newSnapshot.room.status === 'finished' && newSnapshot.room.winner_id) {
        soundFx.playWin();
      }

      // Audio cues from latest log
      if (newSnapshot.logs.length > lastLogsCount.current && newSnapshot.logs[0]) {
        const latest = newSnapshot.logs[0];
        if (latest.type === 'uno') {
          soundFx.playUno();
          showToast(latest.text);
        } else if (latest.type === 'penalty') {
          soundFx.playCatch();
          showToast(latest.text);
        }
      }
      lastLogsCount.current = newSnapshot.logs.length;
    });

    return () => {
      unsubscribe();
    };
  }, [currentRoomCode, playerId, showToast]);

  const createRoom = useCallback(
    (name: string) => {
      if (!playerId) return;
      setLoading(true);
      setError(null);
      try {
        setPlayerName(name);
        const res = unoEngine.createRoom(name, playerId);
        setCurrentRoomCode(res.room_code);
        soundFx.playDraw();
        // Update URL cleanly
        window.history.replaceState({}, '', `?room=${res.room_code}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create room';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [playerId, setPlayerName]
  );

  const joinRoom = useCallback(
    (code: string, name: string) => {
      if (!playerId) return;
      setLoading(true);
      setError(null);
      try {
        setPlayerName(name);
        const res = unoEngine.joinRoom(code, name, playerId);
        if (res.success) {
          setCurrentRoomCode(code.toUpperCase());
          soundFx.playDraw();
          window.history.replaceState({}, '', `?room=${code.toUpperCase()}`);
        } else {
          setError(res.error || 'Failed to join room');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to join room';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [playerId, setPlayerName]
  );

  const addBot = useCallback(() => {
    if (!currentRoomCode || !playerId) return;
    const res = unoEngine.addBotPlayer(currentRoomCode, playerId);
    if (!res.success) {
      showToast(res.error || 'Could not add bot');
    } else {
      soundFx.playDraw();
    }
  }, [currentRoomCode, playerId, showToast]);

  const startGame = useCallback(() => {
    if (!currentRoomCode || !playerId) return;
    const res = unoEngine.startGame(currentRoomCode, playerId);
    if (!res.success) {
      showToast(res.error || 'Could not start game');
    } else {
      soundFx.playCard();
    }
  }, [currentRoomCode, playerId, showToast]);

  const playCard = useCallback(
    (card: UnoCard, chosenColor?: CardColor) => {
      if (!currentRoomCode || !playerId) return;

      // If card is wild and color not yet selected, open color picker
      if (card.color === 'wild' && !chosenColor) {
        setWildCardPending(card);
        return;
      }

      setWildCardPending(null);
      const res = unoEngine.playCard(currentRoomCode, playerId, card.id, chosenColor);
      if (res.success) {
        if (card.value === 'reverse') soundFx.playReverse();
        else if (card.value === 'skip') soundFx.playSkip();
        else if (card.color === 'wild') soundFx.playWild();
        else soundFx.playCard();
      } else {
        showToast(res.error || 'Cannot play this card');
      }
    },
    [currentRoomCode, playerId, showToast]
  );

  const drawCard = useCallback(() => {
    if (!currentRoomCode || !playerId) return;
    const res = unoEngine.drawCard(currentRoomCode, playerId);
    if (res.success) {
      soundFx.playDraw();
      if (res.isPlayable) {
        showToast('✨ You drew a playable card!');
      }
    } else {
      showToast(res.error || 'Cannot draw right now');
    }
  }, [currentRoomCode, playerId, showToast]);

  const callUno = useCallback(() => {
    if (!currentRoomCode || !playerId) return;
    const res = unoEngine.callUno(currentRoomCode, playerId);
    if (res.success) {
      soundFx.playUno();
      showToast('🔥 You shouted UNO!');
    } else {
      showToast(res.error || 'Cannot call UNO');
    }
  }, [currentRoomCode, playerId, showToast]);

  const catchUno = useCallback(
    (targetPlayerId: string) => {
      if (!currentRoomCode || !playerId) return;
      const res = unoEngine.catchUno(currentRoomCode, playerId, targetPlayerId);
      if (res.success) {
        soundFx.playCatch();
      } else {
        showToast(res.error || 'Could not catch player');
      }
    },
    [currentRoomCode, playerId, showToast]
  );

  const restartGame = useCallback(() => {
    if (!currentRoomCode || !playerId) return;
    unoEngine.restartGame(currentRoomCode, playerId);
  }, [currentRoomCode, playerId]);

  const leaveRoom = useCallback(() => {
    setCurrentRoomCode(null);
    setSnapshot(null);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  return {
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
  };
}
