const translationCache = new Map<string, string>();

function buildCacheKey(text: string, target: string) {
  return `${target}::${text}`;
}

async function fetchTranslation(text: string, target: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BuzzerParty/1.0',
      'Accept-Language': target,
    },
  });

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected translation payload');
  }

  const segments = data[0] as unknown[];
  const translated = segments
    .map((segment) => {
      if (!Array.isArray(segment)) {
        return '';
      }
      const [translatedPart] = segment as unknown[];
      return typeof translatedPart === 'string' ? translatedPart : '';
    })
    .join('');

  return translated || text;
}

export async function translateText(text: string, target = 'uk'): Promise<string> {
  if (!text.trim()) {
    return text;
  }

  const key = buildCacheKey(text, target);
  const cached = translationCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const translated = await fetchTranslation(text, target);
    translationCache.set(key, translated);
    return translated;
  } catch (error) {
    translationCache.set(key, text);
    return text;
  }
}

export async function translateQuestion<T extends {
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
}>(question: T, target = 'uk'): Promise<T> {
  const [translatedQuestion, translatedCorrect, translatedIncorrect] = await Promise.all([
    translateText(question.question, target),
    translateText(question.correctAnswer, target),
    Promise.all(question.incorrectAnswers.map((answer) => translateText(answer, target))),
  ]);

  return {
    ...question,
    question: translatedQuestion,
    correctAnswer: translatedCorrect,
    incorrectAnswers: translatedIncorrect,
  };
}
