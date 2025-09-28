import type { RoomSnapshot } from "../types";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

async function request<T>(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body === undefined) {
    headers.delete("content-type");
  }

  const response = await fetch(input, { ...init, headers });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function createSession() {
  return request<{ code: string; hostSecret: string }>("/api/session", {
    method: "POST",
    headers: JSON_HEADERS,
  });
}

export async function getSessionSnapshot(code: string) {
  return request<RoomSnapshot>(`/api/session/${code}`);
}

export type RoomOverview = {
  code: string;
  createdAt: number;
  playerCount: number;
  questionActive: boolean;
  hostOnline: boolean;
  shareActive: boolean;
  shareExpiresAt: number | null;
};

export async function listRooms() {
  return request<RoomOverview[]>(`/api/rooms?v=${new Date().getTime()}`);
}

export async function joinSession(code: string, name: string) {
  return request<{ playerId: string }>(`/api/session/${code}/join`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
}

export async function setTurn(code: string, hostSecret: string, playerId: string) {
  return request<{ ok: true }>(`/api/session/${code}/turn`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ hostSecret, playerId }),
  });
}

export async function activateQuestion(
  code: string,
  hostSecret: string,
  options: { category?: string; difficulty?: 'easy' | 'medium' | 'hard' }
) {
  return request<{ ok: true }>(`/api/session/${code}/question/activate`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ hostSecret, ...options }),
  });
}

export async function openQuestionForBuzzers(code: string, hostSecret: string) {
  return request<{ ok: true }>(`/api/session/${code}/question/open`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ hostSecret }),
  });
}

export async function markQuestionResult(
  code: string,
  hostSecret: string,
  result: 'correct' | 'incorrect',
  options: { playerId?: string; openBuzzers?: boolean } = {}
) {
  return request<{ ok: true }>(`/api/session/${code}/question/mark`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ hostSecret, result, ...options }),
  });
}

export async function cancelActiveQuestion(code: string, hostSecret: string) {
  return request<{ ok: true }>(`/api/session/${code}/question/cancel`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ hostSecret }),
  });
}

export async function leaveSession(code: string, playerId: string) {
  return request<void>(`/api/session/${code}/leave`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId }),
  });
}

export async function destroySession(code: string, hostSecret: string) {
  return request<void>(`/api/session/${code}/destroy`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ hostSecret }),
  });
}

export async function shareRoom(code: string, hostSecret: string) {
  return request<{ shareCode: string; expiresAt: number | null }>(`/api/session/${code}/share`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ hostSecret }),
  });
}

export async function claimShareCode(shareCode: string) {
  return request<{ code: string; hostSecret: string; expiresAt: number | null }>("/api/share/claim", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ shareCode }),
  });
}

export async function getTriviaCategories() {
  return request<Record<string, string[]>>("/api/trivia/categories");
}

type TriviaQuestionsParams = {
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  limit?: number;
};

export async function getTriviaQuestions(params: TriviaQuestionsParams = {}) {
  const search = new URLSearchParams();
  if (params.category) {
    search.set("category", params.category);
  }
  if (params.difficulty) {
    search.set("difficulty", params.difficulty);
  }
  if (params.limit) {
    search.set("limit", String(params.limit));
  }

  const query = search.toString();
  const url = query ? `/api/trivia/questions?${query}` : "/api/trivia/questions";
  return request<Array<{
    id: string;
    question: string;
    correctAnswer: string;
    incorrectAnswers: string[];
    category: string;
    difficulty: string;
  }>>(url);
}
