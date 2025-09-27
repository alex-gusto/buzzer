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

  return response.json();
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
