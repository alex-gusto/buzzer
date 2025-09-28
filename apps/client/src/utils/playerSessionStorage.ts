const STORAGE_KEY = 'buzzer-player-sessions';

type StoredSessions = Record<string, Record<string, PlayerSession>>;

export type PlayerSession = {
  code: string;
  name: string;
  playerId: string;
};

function isStoredSessions(value: unknown): value is StoredSessions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.values(value).every((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }

    return Object.values(entry).every((session) => {
      if (typeof session !== 'object' || session === null) {
        return false;
      }

      const candidate = session as Record<string, unknown>;
      return (
        typeof candidate.code === 'string' &&
        typeof candidate.name === 'string' &&
        typeof candidate.playerId === 'string'
      );
    });
  });
}

function readStorage(): StoredSessions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredSessions(parsed)) {
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
  const codeKey = session.code.toUpperCase();
  next[codeKey] = next[codeKey] ?? {};
  next[codeKey][session.playerId] = session;
  writeStorage(next);
}

export function loadPlayerSession(code: string, playerId: string): PlayerSession | null {
  const sessions = readStorage();
  const codeSessions = sessions[code.toUpperCase()];
  if (!codeSessions) {
    return null;
  }

  return codeSessions[playerId] ?? null;
}

export function clearPlayerSession(code: string, playerId: string) {
  const sessions = readStorage();
  const codeKey = code.toUpperCase();
  const codeSessions = sessions[codeKey];
  if (!codeSessions || !(playerId in codeSessions)) {
    return;
  }

  delete codeSessions[playerId];

  if (Object.keys(codeSessions).length === 0) {
    delete sessions[codeKey];
  }

  writeStorage(sessions);
}
