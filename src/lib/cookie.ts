// Anonymous UUID Player ID management via browser cookie with 24-hour expiry

export const PLAYER_ID_COOKIE = 'uno_player_id';
export const PLAYER_NAME_COOKIE = 'uno_player_name';

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  
  // Fallback to localStorage for browser resilience
  try {
    const local = localStorage.getItem(name);
    if (local) return local;
  } catch {
    // ignore
  }
  return null;
}

export function setCookie(name: string, value: string, days = 1): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  try {
    localStorage.setItem(name, value);
  } catch {
    // ignore
  }
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreatePlayerId(): string {
  let id = getCookie(PLAYER_ID_COOKIE);
  if (!id) {
    id = generateUUID();
    setCookie(PLAYER_ID_COOKIE, id, 1);
  }
  return id;
}

export function getSavedPlayerName(): string {
  return getCookie(PLAYER_NAME_COOKIE) || '';
}

export function savePlayerName(name: string): void {
  setCookie(PLAYER_NAME_COOKIE, name.trim(), 7);
}
