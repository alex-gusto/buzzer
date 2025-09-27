const STORAGE_KEY = 'buzzer-player-sessions';

type StoredSessions = Record<string, PlayerSession>;

export type PlayerSession = {
  code: string;
  name: string;
  playerId: string;
};

function readStorage(): StoredSessions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as StoredSessions;
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function writeStorage(data: StoredSessions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to write player session to storage', error);
  }
}

export function savePlayerSession(session: PlayerSession) {
  const next = readStorage();
  next[session.code.toUpperCase()] = session;
  writeStorage(next);
}

export function loadPlayerSession(code: string): PlayerSession | null {
  const sessions = readStorage();
  return sessions[code.toUpperCase()] ?? null;
}

export function clearPlayerSession(code: string) {
  const sessions = readStorage();
  const normalized = code.toUpperCase();
  if (!(normalized in sessions)) {
    return;
  }

  delete sessions[normalized];
  writeStorage(sessions);
}
