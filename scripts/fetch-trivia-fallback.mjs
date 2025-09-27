import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'https://the-trivia-api.com/api';
const OUTPUT_DIR = path.resolve(__dirname, '../apps/server/fallback');

async function httpGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function fetchCategories() {
  const data = await httpGet(`${API_BASE}/categories`);
  const normalized = {};
  for (const [key, subcategories] of Object.entries(data)) {
    const normalizedKey = slugify(key);
    normalized[normalizedKey] = Array.isArray(subcategories)
      ? subcategories.map((sub) => slugify(sub))
      : [];
  }
  return normalized;
}

async function fetchQuestionsForCategory(category, difficulties, limitPerDifficulty) {
  const result = {};

  for (const difficulty of difficulties) {
    const params = new URLSearchParams({
      limit: String(limitPerDifficulty),
      categories: category,
      difficulty,
    });
    const questions = await httpGet(`${API_BASE}/questions?${params.toString()}`);
    result[difficulty] = questions.map((q) => ({
      id: q.id,
      question: q.question,
      correctAnswer: q.correctAnswer,
      incorrectAnswers: q.incorrectAnswers,
      category: slugify(q.category ?? category),
      difficulty: q.difficulty ?? difficulty,
    }));
  }

  return result;
}

async function main() {
  console.log('Fetching trivia categories…');
  const categories = await fetchCategories();

  await mkdir(OUTPUT_DIR, { recursive: true });
  const categoriesPath = path.join(OUTPUT_DIR, 'categories.json');
  await writeFile(categoriesPath, JSON.stringify(categories, null, 2) + '\n');
  console.log(`Saved categories → ${categoriesPath}`);

  const difficulties = ['easy', 'medium', 'hard'];
  const questions = {};

  for (const category of Object.keys(categories)) {
    console.log(`Fetching questions for ${category}…`);
    try {
      questions[category] = await fetchQuestionsForCategory(category, difficulties, 10);
    } catch (error) {
      console.warn(`Failed to fetch questions for ${category}:`, error.message);
    }
  }

  const questionsPath = path.join(OUTPUT_DIR, 'questions.json');
  await writeFile(questionsPath, JSON.stringify(questions, null, 2) + '\n');
  console.log(`Saved questions → ${questionsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
