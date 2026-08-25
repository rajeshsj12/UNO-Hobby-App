import {
  CardColor,
  FullGameSnapshot,
  GameLogEntry,
  Player,
  Room,
  UnoCard,
} from '../types';
import {
  calculateDecksNeeded,
  generateStandardDeck,
  isCardPlayable,
  shuffleDeck,
} from '../lib/deckMath';
import { generateUUID } from '../lib/cookie';

interface InternalRoomState {
  room: Room;
  players: Player[];
  draw_pile: UnoCard[];
  discard_pile: UnoCard[];
  hands: Record<string, UnoCard[]>; // player_id -> cards
  logs: GameLogEntry[];
}

class UnoEngine {
  private rooms: Map<string, InternalRoomState> = new Map();
  private subscribers: Map<string, Set<(snapshot: FullGameSnapshot) => void>> = new Map();

  constructor() {
    // Load persisted rooms from localStorage if in browser
    this.restoreFromStorage();
  }

  private persistToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const serializable: Record<string, unknown> = {};
      this.rooms.forEach((val, key) => {
        serializable[key] = val;
      });
      localStorage.setItem('uno_local_rooms', JSON.stringify(serializable));
    } catch {
      // storage quota or unavailable
    }
  }

  private restoreFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('uno_local_rooms');
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.entries(parsed).forEach(([key, value]) => {
          this.rooms.set(key, value as InternalRoomState);
        });
      }
    } catch {
      // ignore
    }
  }

  public subscribe(roomCode: string, playerId: string, callback: (snapshot: FullGameSnapshot) => void): () => void {
    const key = roomCode.toUpperCase();
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    const set = this.subscribers.get(key)!;
    const wrappedCb = () => {
      const snapshot = this.getSnapshot(key, playerId);
      if (snapshot) callback(snapshot);
    };
    set.add(wrappedCb);

    // Initial trigger
    const initial = this.getSnapshot(key, playerId);
    if (initial) callback(initial);

    return () => {
      set.delete(wrappedCb);
    };
  }

  private broadcast(roomCode: string) {
    const key = roomCode.toUpperCase();
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb({} as FullGameSnapshot); // triggers wrappedCb
        } catch (e) {
          console.error('Broadcast error:', e);
        }
      });
    }
    this.persistToStorage();
  }

  private addLog(state: InternalRoomState, text: string, type: GameLogEntry['type']) {
    const entry: GameLogEntry = {
      id: generateUUID(),
      timestamp: Date.now(),
      text,
      type,
    };
    state.logs.unshift(entry);
    if (state.logs.length > 50) state.logs.pop();
  }

  public createRoom(playerName: string, hostPlayerId: string): { room_id: string; room_code: string } {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const roomId = generateUUID();

    const hostPlayer: Player = {
      id: hostPlayerId,
      room_id: roomId,
      name: playerName.trim() || 'Host Player',
      seat_index: 0,
      is_host: true,
      is_bot: false,
      called_uno: false,
      card_count: 0,
      connected: true,
    };

    const room: Room = {
      id: roomId,
      room_code: roomCode,
      status: 'waiting',
      current_turn_index: 0,
      play_direction: 1,
      current_color: 'red',
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      winner_id: null,
      deck_count: 1,
    };

    const state: InternalRoomState = {
      room,
      players: [hostPlayer],
      draw_pile: [],
      discard_pile: [],
      hands: { [hostPlayerId]: [] },
      logs: [],
    };

    this.addLog(state, `Room ${roomCode} created by ${hostPlayer.name}`, 'info');
    this.rooms.set(roomCode, state);
    this.broadcast(roomCode);

    return { room_id: roomId, room_code: roomCode };
  }

  public joinRoom(roomCode: string, playerName: string, playerId: string): { success: boolean; error?: string } {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state) {
      return { success: false, error: 'Room not found. Check the code and try again.' };
    }

    // Reconnect case
    const existing = state.players.find((p) => p.id === playerId);
    if (existing) {
      existing.connected = true;
      state.room.last_active_at = new Date().toISOString();
      this.broadcast(key);
      return { success: true };
    }

    if (state.room.status !== 'waiting') {
      return { success: false, error: 'Game has already started in this room.' };
    }

    if (state.players.length >= 20) {
      return { success: false, error: 'Room is full (Maximum 20 players allowed).' };
    }

    // Find first available seat index 0..19
    const takenSeats = new Set(state.players.map((p) => p.seat_index));
    let nextSeat = 0;
    while (takenSeats.has(nextSeat) && nextSeat < 20) {
      nextSeat++;
    }

    const newPlayer: Player = {
      id: playerId,
      room_id: state.room.id,
      name: playerName.trim() || `Player ${state.players.length + 1}`,
      seat_index: nextSeat,
      is_host: false,
      is_bot: false,
      called_uno: false,
      card_count: 0,
      connected: true,
    };

    state.players.push(newPlayer);
    state.players.sort((a, b) => a.seat_index - b.seat_index);
    state.hands[playerId] = [];
    state.room.last_active_at = new Date().toISOString();

    this.addLog(state, `${newPlayer.name} joined the room (Seat ${nextSeat + 1})`, 'info');
    this.broadcast(key);

    return { success: true };
  }

  public addBotPlayer(roomCode: string, hostPlayerId: string): { success: boolean; error?: string } {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state) return { success: false, error: 'Room not found' };

    const host = state.players.find((p) => p.id === hostPlayerId);
    if (!host?.is_host) return { success: false, error: 'Only host can add bot players' };

    if (state.players.length >= 20) return { success: false, error: 'Max 20 players reached' };
    if (state.room.status !== 'waiting') return { success: false, error: 'Cannot add bots after game start' };

    const botNames = [
      'Byte', 'Pixel', 'Nova', 'Echo', 'Sparks', 'Cosmo', 'Blaze', 'Ziggy',
      'Vortex', 'Quark', 'Rogue', 'Apex', 'Blitz', 'Cipher', 'Flux', 'Drift',
      'Sonic', 'Turbo', 'Shadow', 'Atlas'
    ];
    const unusedName = botNames.find((n) => !state.players.some((p) => p.name.includes(n))) || `Bot-${state.players.length + 1}`;

    const takenSeats = new Set(state.players.map((p) => p.seat_index));
    let nextSeat = 0;
    while (takenSeats.has(nextSeat) && nextSeat < 20) {
      nextSeat++;
    }

    const botId = `bot_${generateUUID()}`;
    const botPlayer: Player = {
      id: botId,
      room_id: state.room.id,
      name: `${unusedName} (AI)`,
      seat_index: nextSeat,
      is_host: false,
      is_bot: true,
      called_uno: false,
      card_count: 0,
      connected: true,
    };

    state.players.push(botPlayer);
    state.players.sort((a, b) => a.seat_index - b.seat_index);
    state.hands[botId] = [];

    this.addLog(state, `Bot player ${botPlayer.name} added to seat ${nextSeat + 1}`, 'info');
    this.broadcast(key);

    return { success: true };
  }

  public startGame(roomCode: string, hostPlayerId: string): { success: boolean; error?: string } {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state) return { success: false, error: 'Room not found' };

    const host = state.players.find((p) => p.id === hostPlayerId);
    if (!host?.is_host) return { success: false, error: 'Only host can start game' };

    if (state.players.length < 2) return { success: false, error: 'Need at least 2 players to start Uno' };

    // 20-Player Deck Math: ceil((players * 7 + 40) / 108)
    const decksNeeded = calculateDecksNeeded(state.players.length);
    state.room.deck_count = decksNeeded;
    let fullDeck = generateStandardDeck(decksNeeded);

    // Deal 7 cards to each player
    state.players.forEach((p) => {
      state.hands[p.id] = fullDeck.slice(0, 7);
      fullDeck = fullDeck.slice(7);
      p.card_count = 7;
      p.called_uno = false;
    });

    // Find starting card (non-wild, non-action for fair start)
    const startCardIdx = fullDeck.findIndex(
      (c) => c.color !== 'wild' && !['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(c.value)
    );
    let startCard: UnoCard;
    if (startCardIdx !== -1) {
      startCard = fullDeck.splice(startCardIdx, 1)[0];
    } else {
      startCard = fullDeck.shift()!;
    }

    state.draw_pile = fullDeck;
    state.discard_pile = [startCard];
    state.room.status = 'playing';
    state.room.current_turn_index = 0;
    state.room.play_direction = 1;
    state.room.current_color = startCard.color;
    state.room.winner_id = null;
    state.room.last_active_at = new Date().toISOString();

    this.addLog(
      state,
      `Game started with ${state.players.length} players (${decksNeeded} deck${decksNeeded > 1 ? 's' : ''})! First card: ${startCard.color.toUpperCase()} ${startCard.value.toUpperCase()}`,
      'info'
    );
    this.broadcast(key);

    // Trigger bot turn if seat 0 is bot
    this.checkTriggerBotTurn(key);

    return { success: true };
  }

  public playCard(
    roomCode: string,
    playerId: string,
    cardId: string,
    chosenColor?: CardColor
  ): { success: boolean; error?: string } {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state || state.room.status !== 'playing') {
      return { success: false, error: 'Game not currently active' };
    }

    const player = state.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not in room' };

    if (player.seat_index !== state.room.current_turn_index) {
      return { success: false, error: 'Not your turn!' };
    }

    const hand = state.hands[playerId] || [];
    const cardIndex = hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return { success: false, error: 'Card not in your hand' };

    const card = hand[cardIndex];
    const topCard = state.discard_pile[state.discard_pile.length - 1];

    if (!isCardPlayable(card, state.room.current_color, topCard)) {
      return { success: false, error: `Illegal move! Must match ${state.room.current_color} or ${topCard.value}` };
    }

    // Remove card from hand
    hand.splice(cardIndex, 1);
    player.card_count = hand.length;

    // Determine new active color
    let newColor: CardColor = card.color;
    if (card.color === 'wild') {
      newColor = chosenColor && ['red', 'blue', 'green', 'yellow'].includes(chosenColor) ? chosenColor : 'red';
    }

    // Add to discard pile
    state.discard_pile.push(card);

    // Win Check!
    if (hand.length === 0) {
      state.room.status = 'finished';
      state.room.winner_id = player.id;
      this.addLog(state, `🏆 ${player.name} has played their last card and WON THE GAME!`, 'win');
      this.broadcast(key);
      return { success: true };
    }

    const playerCount = state.players.length;
    let step = state.room.play_direction;
    let nextTurn = state.room.current_turn_index;

    // Handle Action Cards
    if (card.value === 'reverse') {
      if (playerCount === 2) {
        // 2-Player Edge Case: Reverse acts as Skip
        nextTurn = state.room.current_turn_index;
        this.addLog(state, `⇄ ${player.name} played Reverse (Acts as Skip in 2-player mode!)`, 'action');
      } else {
        step = (step * -1) as 1 | -1;
        state.room.play_direction = step;
        nextTurn = (state.room.current_turn_index + step + playerCount) % playerCount;
        this.addLog(state, `⇄ Play direction reversed by ${player.name}!`, 'action');
      }
    } else if (card.value === 'skip') {
      const skippedIndex = (state.room.current_turn_index + step + playerCount) % playerCount;
      const skippedPlayer = state.players.find((p) => p.seat_index === skippedIndex);
      nextTurn = (state.room.current_turn_index + step * 2 + playerCount * 2) % playerCount;
      this.addLog(state, `⊘ ${skippedPlayer?.name || 'Next player'} was skipped by ${player.name}!`, 'action');
    } else if (card.value === 'draw2') {
      const victimIndex = (state.room.current_turn_index + step + playerCount) % playerCount;
      const victim = state.players.find((p) => p.seat_index === victimIndex);
      if (victim) {
        this.dealPenaltyCards(state, victim.id, 2);
        this.addLog(state, `⚡ ${victim.name} drew +2 cards and was skipped!`, 'action');
      }
      nextTurn = (victimIndex + step + playerCount) % playerCount;
    } else if (card.value === 'wild4') {
      const victimIndex = (state.room.current_turn_index + step + playerCount) % playerCount;
      const victim = state.players.find((p) => p.seat_index === victimIndex);
      if (victim) {
        this.dealPenaltyCards(state, victim.id, 4);
        this.addLog(state, `💥 ${victim.name} drew +4 cards and was skipped! Color changed to ${newColor.toUpperCase()}`, 'action');
      }
      nextTurn = (victimIndex + step + playerCount) % playerCount;
    } else if (card.value === 'wild') {
      nextTurn = (state.room.current_turn_index + step + playerCount) % playerCount;
      this.addLog(state, `🌈 ${player.name} played Wild and picked ${newColor.toUpperCase()}`, 'action');
    } else {
      nextTurn = (state.room.current_turn_index + step + playerCount) % playerCount;
      this.addLog(state, `${player.name} played ${card.color.toUpperCase()} ${card.value.toUpperCase()}`, 'action');
    }

    // Reset called_uno if player has > 1 card now
    if (hand.length > 1) {
      player.called_uno = false;
    }

    state.room.current_turn_index = nextTurn;
    state.room.current_color = newColor;
    state.room.last_active_at = new Date().toISOString();

    this.broadcast(key);

    // Bot automation trigger
    this.checkTriggerBotTurn(key);

    return { success: true };
  }

  public drawCard(roomCode: string, playerId: string): { success: boolean; drawnCard?: UnoCard; isPlayable?: boolean; error?: string } {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state || state.room.status !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const player = state.players.find((p) => p.id === playerId);
    if (!player || player.seat_index !== state.room.current_turn_index) {
      return { success: false, error: 'Not your turn to draw' };
    }

    this.ensureDrawPile(state);
    if (state.draw_pile.length === 0) {
      return { success: false, error: 'No cards available to draw' };
    }

    const drawnCard = state.draw_pile.shift()!;
    const hand = state.hands[playerId] || [];
    hand.push(drawnCard);
    player.card_count = hand.length;

    const topCard = state.discard_pile[state.discard_pile.length - 1];
    const playable = isCardPlayable(drawnCard, state.room.current_color, topCard);

    // Turn passes to next player
    const playerCount = state.players.length;
    const nextTurn = (state.room.current_turn_index + state.room.play_direction + playerCount) % playerCount;
    state.room.current_turn_index = nextTurn;
    state.room.last_active_at = new Date().toISOString();

    this.addLog(state, `${player.name} drew a card`, 'info');
    this.broadcast(key);

    this.checkTriggerBotTurn(key);

    return { success: true, drawnCard, isPlayable: playable };
  }

  public callUno(roomCode: string, playerId: string): { success: boolean; error?: string } {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state) return { success: false, error: 'Room not found' };

    const player = state.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const hand = state.hands[playerId] || [];
    if (hand.length > 2) {
      return { success: false, error: 'You can only call UNO when you have 2 cards or fewer!' };
    }

    player.called_uno = true;
    this.addLog(state, `🔥 ${player.name} shouted UNO!`, 'uno');
    this.broadcast(key);

    return { success: true };
  }

  public catchUno(roomCode: string, accuserPlayerId: string, targetPlayerId: string): { success: boolean; error?: string } {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state) return { success: false, error: 'Room not found' };

    const accuser = state.players.find((p) => p.id === accuserPlayerId);
    const target = state.players.find((p) => p.id === targetPlayerId);
    if (!accuser || !target) return { success: false, error: 'Player not found' };

    const hand = state.hands[targetPlayerId] || [];
    if (hand.length === 1 && !target.called_uno) {
      this.dealPenaltyCards(state, targetPlayerId, 2);
      this.addLog(
        state,
        `🚨 ${accuser.name} caught ${target.name} forgetting to say UNO! ${target.name} drew 2 penalty cards!`,
        'penalty'
      );
      this.broadcast(key);
      return { success: true };
    }

    return { success: false, error: 'Player has already called UNO or does not have exactly 1 card!' };
  }

  private dealPenaltyCards(state: InternalRoomState, targetPlayerId: string, count: number) {
    const hand = state.hands[targetPlayerId] || [];
    const targetPlayer = state.players.find((p) => p.id === targetPlayerId);

    for (let i = 0; i < count; i++) {
      this.ensureDrawPile(state);
      if (state.draw_pile.length > 0) {
        const card = state.draw_pile.shift()!;
        hand.push(card);
      }
    }
    if (targetPlayer) {
      targetPlayer.card_count = hand.length;
      targetPlayer.called_uno = false;
    }
  }

  private ensureDrawPile(state: InternalRoomState) {
    if (state.draw_pile.length === 0 && state.discard_pile.length > 1) {
      const topCard = state.discard_pile.pop()!;
      const rest = state.discard_pile;
      state.draw_pile = shuffleDeck(rest);
      state.discard_pile = [topCard];
      this.addLog(state, 'Draw pile depleted - reshuffled discard pile!', 'info');
    }
  }

  private checkTriggerBotTurn(roomCode: string) {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state || state.room.status !== 'playing') return;

    const currentTurn = state.room.current_turn_index;
    const activePlayer = state.players.find((p) => p.seat_index === currentTurn);

    if (activePlayer && activePlayer.is_bot) {
      setTimeout(() => {
        this.executeBotTurn(key, activePlayer.id);
      }, 900);
    }
  }

  private executeBotTurn(roomCode: string, botId: string) {
    const state = this.rooms.get(roomCode);
    if (!state || state.room.status !== 'playing') return;

    const bot = state.players.find((p) => p.id === botId);
    if (!bot || bot.seat_index !== state.room.current_turn_index) return;

    const hand = state.hands[botId] || [];
    const topCard = state.discard_pile[state.discard_pile.length - 1];

    // Bot decides if it should call UNO (80% chance if 2 cards)
    if (hand.length === 2 && Math.random() > 0.15) {
      bot.called_uno = true;
      this.addLog(state, `🔥 ${bot.name} called UNO!`, 'uno');
    }

    // Find playable cards
    const playableCards = hand.filter((c) => isCardPlayable(c, state.room.current_color, topCard));

    if (playableCards.length > 0) {
      // Prioritize action/color match over wild
      const nonWild = playableCards.find((c) => c.color !== 'wild');
      const cardToPlay = nonWild || playableCards[0];

      // Pick best color if wild
      let chosenColor: CardColor = 'blue';
      if (cardToPlay.color === 'wild') {
        const colorCounts: Record<CardColor, number> = { red: 0, blue: 0, green: 0, yellow: 0, wild: 0 };
        hand.forEach((c) => {
          if (c.color !== 'wild') colorCounts[c.color]++;
        });
        const highestColor = (['red', 'blue', 'green', 'yellow'] as CardColor[]).reduce((a, b) =>
          colorCounts[a] >= colorCounts[b] ? a : b
        );
        chosenColor = highestColor;
      }

      this.playCard(roomCode, botId, cardToPlay.id, chosenColor);
    } else {
      // Draw card
      this.drawCard(roomCode, botId);
    }
  }

  public getSnapshot(roomCode: string, playerId: string): FullGameSnapshot | null {
    const key = roomCode.toUpperCase();
    const state = this.rooms.get(key);
    if (!state) return null;

    const topCard = state.discard_pile[state.discard_pile.length - 1] || null;
    const myHand = state.hands[playerId] || [];

    return {
      room: { ...state.room },
      players: state.players.map((p) => ({
        ...p,
        card_count: (state.hands[p.id] || []).length,
      })),
      top_card: topCard,
      discard_pile: [...state.discard_pile],
      draw_pile_count: state.draw_pile.length,
      my_hand: [...myHand],
      my_player_id: playerId,
      logs: [...state.logs],
    };
  }

  public restartGame(roomCode: string, hostPlayerId: string): { success: boolean; error?: string } {
    return this.startGame(roomCode, hostPlayerId);
  }
}

export const unoEngine = new UnoEngine();
