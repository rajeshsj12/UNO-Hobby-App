export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';

export type CardValue =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4';

export interface UnoCard {
  id: string;
  color: CardColor;
  value: CardValue;
  score: number;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  room_code: string;
  status: RoomStatus;
  current_turn_index: number;
  play_direction: 1 | -1; // 1 = clockwise, -1 = counter-clockwise
  current_color: CardColor;
  last_active_at: string;
  created_at: string;
  winner_id?: string | null;
  deck_count?: number;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  seat_index: number;
  is_host: boolean;
  is_bot?: boolean;
  called_uno: boolean;
  card_count: number;
  avatar_seed?: string;
  last_action?: string;
  connected?: boolean;
}

export interface GameState {
  room_id: string;
  draw_pile_count: number;
  discard_pile: UnoCard[];
  top_card: UnoCard | null;
  draw_pile?: UnoCard[]; // server-only or full state
}

export interface PlayerHand {
  player_id: string;
  room_id: string;
  cards: UnoCard[];
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  text: string;
  type: 'info' | 'action' | 'uno' | 'turn' | 'win' | 'penalty';
}

export interface FullGameSnapshot {
  room: Room;
  players: Player[];
  top_card: UnoCard;
  discard_pile: UnoCard[];
  draw_pile_count: number;
  my_hand: UnoCard[];
  my_player_id: string;
  logs: GameLogEntry[];
}
