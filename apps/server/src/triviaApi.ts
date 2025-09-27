const API_BASE = 'https://the-trivia-api.com/api';

export type TriviaCategoryResponse = Record<string, string[]>;

export type TriviaQuestion = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
};

async function httpGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);

  if (!response.ok) {
    throw new Error(`Trivia API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchTriviaCategories(): Promise<TriviaCategoryResponse> {
  return httpGet<TriviaCategoryResponse>('/categories');
}

type FetchQuestionOptions = {
  category?: string;
  difficulty?: string;
  excludeIds?: Set<string>;
};

export async function fetchTriviaQuestion(options: FetchQuestionOptions = {}): Promise<TriviaQuestion> {
  const params = new URLSearchParams({ limit: '1' });

  if (options.category) {
    params.set('categories', options.category);
  }

  if (options.difficulty) {
    params.set('difficulty', options.difficulty);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [question] = await httpGet<TriviaQuestion[]>(`/questions?${params.toString()}`);

    if (!question) {
      throw new Error('Trivia API returned no questions');
    }

    if (options.excludeIds?.has(question.id)) {
      continue;
    }

    return question;
  }

  throw new Error('Unable to fetch a unique trivia question');
}

export async function fetchTriviaQuestions(options: FetchQuestionOptions & { limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);
  const params = new URLSearchParams({ limit: String(limit) });

  if (options.category) {
    params.set('categories', options.category);
  }

  if (options.difficulty) {
    params.set('difficulty', options.difficulty);
  }

  return httpGet<TriviaQuestion[]>(`/questions?${params.toString()}`);
}
