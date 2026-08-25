import { CardColor, CardValue, UnoCard } from '../types';

export const CARD_COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow'];

export function calculateDecksNeeded(playerCount: number): number {
  return Math.max(1, Math.ceil((playerCount * 7 + 40) / 108));
}

export function generateStandardDeck(deckCount = 1): UnoCard[] {
  const cards: UnoCard[] = [];
  let idCounter = 1;

  for (let d = 0; d < deckCount; d++) {
    for (const color of CARD_COLORS) {
      // One 0 per color
      cards.push({
        id: `c_${d}_${idCounter++}`,
        color,
        value: '0',
        score: 0,
      });

      // Two 1-9 per color
      for (let n = 1; n <= 9; n++) {
        cards.push({
          id: `c_${d}_${idCounter++}`,
          color,
          value: n.toString() as CardValue,
          score: n,
        });
        cards.push({
          id: `c_${d}_${idCounter++}`,
          color,
          value: n.toString() as CardValue,
          score: n,
        });
      }

      // Two Skip, Two Reverse, Two Draw 2 (+2)
      for (let a = 0; a < 2; a++) {
        cards.push({
          id: `c_${d}_${idCounter++}`,
          color,
          value: 'skip',
          score: 20,
        });
        cards.push({
          id: `c_${d}_${idCounter++}`,
          color,
          value: 'reverse',
          score: 20,
        });
        cards.push({
          id: `c_${d}_${idCounter++}`,
          color,
          value: 'draw2',
          score: 20,
        });
      }
    }

    // Four Wild and Four Wild Draw 4 (+4)
    for (let w = 0; w < 4; w++) {
      cards.push({
        id: `c_${d}_${idCounter++}`,
        color: 'wild',
        value: 'wild',
        score: 50,
      });
      cards.push({
        id: `c_${d}_${idCounter++}`,
        color: 'wild',
        value: 'wild4',
        score: 50,
      });
    }
  }

  return shuffleDeck(cards);
}

export function shuffleDeck<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isCardPlayable(card: UnoCard, currentColor: CardColor, topCard: UnoCard | null): boolean {
  if (!topCard) return true;
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

export function getColorClass(color: CardColor): {
  bg: string;
  border: string;
  text: string;
  glow: string;
  pill: string;
} {
  switch (color) {
    case 'red':
      return {
        bg: 'bg-red-500',
        border: 'border-red-400',
        text: 'text-red-500',
        glow: 'shadow-red-500/50 ring-red-400',
        pill: 'bg-red-500 text-white',
      };
    case 'blue':
      return {
        bg: 'bg-blue-500',
        border: 'border-blue-400',
        text: 'text-blue-500',
        glow: 'shadow-blue-500/50 ring-blue-400',
        pill: 'bg-blue-500 text-white',
      };
    case 'green':
      return {
        bg: 'bg-emerald-500',
        border: 'border-emerald-400',
        text: 'text-emerald-500',
        glow: 'shadow-emerald-500/50 ring-emerald-400',
        pill: 'bg-emerald-500 text-white',
      };
    case 'yellow':
      return {
        bg: 'bg-amber-400',
        border: 'border-amber-300',
        text: 'text-amber-500',
        glow: 'shadow-amber-400/50 ring-amber-300',
        pill: 'bg-amber-400 text-slate-900 font-bold',
      };
    case 'wild':
    default:
      return {
        bg: 'bg-slate-900',
        border: 'border-purple-400',
        text: 'text-purple-400',
        glow: 'shadow-purple-500/50 ring-purple-400',
        pill: 'bg-gradient-to-r from-red-500 via-yellow-400 via-emerald-500 to-blue-500 text-white font-bold',
      };
  }
}

export function formatCardLabel(value: CardValue): string {
  switch (value) {
    case 'skip':
      return '⊘';
    case 'reverse':
      return '⇄';
    case 'draw2':
      return '+2';
    case 'wild':
      return 'WILD';
    case 'wild4':
      return '+4';
    default:
      return value;
  }
}
