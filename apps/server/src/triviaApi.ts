import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API_BASE = (process.env.TRIVIA_API_BASE ?? 'https://the-trivia-api.com/api').replace(/\/$/, '');

export type TriviaCategoryResponse = Record<string, string[]>;

export type TriviaQuestion = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
};

type FallbackQuestions = Record<string, Record<string, TriviaQuestion[]>>;

const fallbackCategoriesPath = new URL('../fallback/categories.json', import.meta.url);
const fallbackQuestionsPath = new URL('../fallback/questions.json', import.meta.url);

let fallbackCategoriesCache: TriviaCategoryResponse | null | undefined;
let fallbackQuestionsCache: FallbackQuestions | null | undefined;

async function httpGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);

  if (!response.ok) {
    throw new Error(`Trivia API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function loadFallbackCategories() {
  if (fallbackCategoriesCache !== undefined) {
    return fallbackCategoriesCache;
  }

  try {
    const raw = await readFile(fallbackCategoriesPath, 'utf-8');
    fallbackCategoriesCache = JSON.parse(raw) as TriviaCategoryResponse;
  } catch (error) {
    fallbackCategoriesCache = null;
  }

  return fallbackCategoriesCache;
}

async function loadFallbackQuestions() {
  if (fallbackQuestionsCache !== undefined) {
    return fallbackQuestionsCache;
  }

  try {
    const raw = await readFile(fallbackQuestionsPath, 'utf-8');
    fallbackQuestionsCache = JSON.parse(raw) as FallbackQuestions;
  } catch (error) {
    fallbackQuestionsCache = null;
  }

  return fallbackQuestionsCache;
}

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) {
    return null;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function fetchTriviaCategories(): Promise<TriviaCategoryResponse> {
  try {
    const data = await httpGet<Record<string, string[]>>('/categories');
    const normalized: TriviaCategoryResponse = {};

    for (const [group, subcategories] of Object.entries(data)) {
      normalized[slugify(group)] = Array.isArray(subcategories)
        ? subcategories.map((sub) => slugify(sub))
        : [];
    }

    return normalized;
  } catch (error) {
    const fallback = await loadFallbackCategories();
    if (fallback) {
      return fallback;
    }
    throw error;
  }
}

type FetchQuestionOptions = {
  category?: string;
  difficulty?: string;
  excludeIds?: Set<string>;
};

async function fetchFallbackQuestion(options: FetchQuestionOptions): Promise<TriviaQuestion> {
  const fallback = await loadFallbackQuestions();
  if (!fallback) {
    throw new Error('No fallback trivia questions available');
  }

  const categoryKey = options.category ? slugify(options.category) : null;
  const difficultyKey = options.difficulty ?? null;

  const candidateCategories = categoryKey && fallback[categoryKey]
    ? [categoryKey]
    : Object.keys(fallback);

  for (const cat of candidateCategories) {
    const difficultyBuckets = fallback[cat];
    if (!difficultyBuckets) continue;

    const difficulties = difficultyKey && difficultyBuckets[difficultyKey]
      ? [difficultyKey]
      : Object.keys(difficultyBuckets);

    for (const diff of difficulties) {
      const questions = difficultyBuckets[diff] ?? [];
      const filtered = questions.filter((q) => !options.excludeIds?.has(q.id));
      const chosen = pickRandom(filtered);
      if (chosen) {
        return chosen;
      }
    }
  }

  throw new Error('Fallback trivia exhausted for given criteria');
}

export async function fetchTriviaQuestion(options: FetchQuestionOptions = {}): Promise<TriviaQuestion> {
  const params = new URLSearchParams({ limit: '1' });

  if (options.category) {
    params.set('categories', options.category);
  }

  if (options.difficulty) {
    params.set('difficulty', options.difficulty);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [question] = await httpGet<TriviaQuestion[]>(`/questions?${params.toString()}`);

      if (!question) {
        continue;
      }

      if (options.excludeIds?.has(question.id)) {
        continue;
      }

      return {
        ...question,
        category: slugify(question.category ?? options.category ?? ''),
        difficulty: question.difficulty ?? options.difficulty ?? 'medium',
      };
    } catch (error) {
      // fall through to fallback
      break;
    }
  }

  return fetchFallbackQuestion(options);
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

  try {
    const questions = await httpGet<TriviaQuestion[]>(`/questions?${params.toString()}`);
    return questions.map((q) => ({
      ...q,
      category: slugify(q.category ?? options.category ?? ''),
      difficulty: q.difficulty ?? options.difficulty ?? 'medium',
    }));
  } catch (error) {
    const fallback = await loadFallbackQuestions();
    if (!fallback) {
      throw error;
    }

    const pool: TriviaQuestion[] = [];
    const categoryKey = options.category ? slugify(options.category) : null;
    const difficultyKey = options.difficulty ?? null;

    const candidateCategories = categoryKey && fallback[categoryKey]
      ? [categoryKey]
      : Object.keys(fallback);

    for (const cat of candidateCategories) {
      const difficultyBuckets = fallback[cat];
      if (!difficultyBuckets) continue;

      const difficulties = difficultyKey && difficultyBuckets[difficultyKey]
        ? [difficultyKey]
        : Object.keys(difficultyBuckets);

      for (const diff of difficulties) {
        const buckets = difficultyBuckets[diff] ?? [];
        buckets.forEach((question) => {
          pool.push(question);
        });
      }
    }

    return shuffle(pool).slice(0, limit);
  }
}
