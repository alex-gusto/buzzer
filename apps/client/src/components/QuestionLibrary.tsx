import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { getTriviaCategories, getTriviaQuestions } from '../api';

type PreviewState = {
  key: string;
  label: string;
  questions: Array<{
    id: string;
    question: string;
    correctAnswer: string;
    difficulty: string;
    category: string;
  }>;
};

const DIFFICULTIES: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

function formatLabel(slug: string) {
  return slug
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function QuestionLibrary() {
  const { data: categoriesData, isLoading, isError } = useQuery({
    queryKey: ['trivia-categories'],
    queryFn: getTriviaCategories,
    staleTime: 1000 * 60 * 60,
  });

  const categories = useMemo(() => {
    if (!categoriesData) {
      return [] as Array<{
        label: string;
        value: string;
        subcategories: Array<{ label: string; value: string }>;
      }>;
    }

    return Object.entries(categoriesData).map(([group, subcategories]) => ({
      label: formatLabel(group),
      value: group,
      subcategories: subcategories.map((sub) => ({
        label: formatLabel(sub),
        value: sub,
      })),
    }));
  }, [categoriesData]);

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const previewMutation = useMutation<
    PreviewState,
    Error,
    { category?: string; difficulty?: 'easy' | 'medium' | 'hard'; label: string }
  >({
    mutationFn: async (params) => {
      const questions = await getTriviaQuestions({
        category: params.category,
        difficulty: params.difficulty,
        limit: 5,
      });

      return {
        key: `${params.category ?? 'any'}|${params.difficulty ?? 'any'}`,
        label: params.label,
        questions,
      } satisfies PreviewState;
    },
    onMutate: (variables) => {
      setLoadingKey(`${variables.category ?? 'any'}|${variables.difficulty ?? 'any'}`);
    },
    onSuccess: (result) => {
      setPreview(result);
    },
    onSettled: () => {
      setLoadingKey(null);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 rounded-[28px] bg-slate-950/85 px-6 py-8 shadow-glow backdrop-blur">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-500/40 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
          >
            <span aria-hidden>←</span>
            Back
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Question Library</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Browse categories and preview fresh questions pulled from The Trivia API.
            </p>
          </div>
        </header>

        {isLoading ? (
          <section className="rounded-2xl bg-slate-900/70 p-6 text-sm text-slate-300">
            Loading categories…
          </section>
        ) : isError ? (
          <section className="rounded-2xl bg-slate-900/70 p-6 text-sm text-rose-200">
            Unable to load categories right now. Try refreshing later.
          </section>
        ) : (
          <section className="grid gap-6 rounded-2xl bg-slate-900/70 p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <article
                  key={category.value}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-500/30 bg-slate-900/80 p-5"
                >
                  <header className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-100">{category.label}</h2>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {category.subcategories.length} subcategories
                    </p>
                  </header>
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {category.subcategories.slice(0, 4).map((sub) => (
                      <span key={sub.value} className="rounded-full bg-slate-800/70 px-3 py-1">
                        {sub.label}
                      </span>
                    ))}
                    {category.subcategories.length > 4 ? <span>…</span> : null}
                  </div>
                  <div className="mt-2 grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                    {DIFFICULTIES.map((difficulty) => {
                      const key = `${category.value}|${difficulty}`;
                      const isLoadingPreview = previewMutation.isPending && loadingKey === key;

                      return (
                        <button
                          key={difficulty}
                          type="button"
                          onClick={() =>
                            previewMutation.mutate({
                              category: category.value,
                              difficulty,
                              label: `${category.label} · ${difficulty}`,
                            })
                          }
                          disabled={isLoadingPreview}
                          className="inline-flex items-center justify-between rounded-xl border border-slate-500/40 bg-slate-950/70 px-4 py-2 text-left text-slate-100 transition hover:border-cyan-400/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span>{difficulty}</span>
                          <span className="text-[0.7rem] text-slate-400">Preview</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        previewMutation.mutate({
                          category: category.value,
                          difficulty: undefined,
                          label: `${category.label} · random`,
                        })
                      }
                      disabled={previewMutation.isPending && loadingKey === `${category.value}|any`}
                      className="inline-flex items-center justify-between rounded-xl border border-slate-500/40 bg-slate-950/70 px-4 py-2 text-left text-slate-100 transition hover:border-cyan-400/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>Random difficulty</span>
                      <span className="text-[0.7rem] text-slate-400">Preview</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {preview ? (
          <section className="rounded-2xl bg-slate-900/70 p-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold text-slate-100">Sample questions · {preview.label}</h3>
              <p className="text-sm text-slate-400">
                Pulled live from The Trivia API. Each refresh may yield different prompts.
              </p>
            </div>
            <ul className="mt-4 grid gap-3">
              {preview.questions.map((question) => (
                <li
                  key={question.id}
                  className="rounded-2xl border border-slate-500/30 bg-slate-950/80 p-4"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span>{question.category}</span>
                    <span>{question.difficulty}</span>
                  </header>
                  <p className="mt-3 text-sm text-slate-100">{question.question}</p>
                  <p className="mt-3 text-xs text-slate-400">
                    Correct answer: <span className="text-slate-200">{question.correctAnswer}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
