import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";

import { useSessionConnection } from "../hooks/useSessionConnection";
import { HostSecretError } from "./HostSecretError";

const DIFFICULTIES: Array<"easy" | "medium" | "hard"> = [
  "easy",
  "medium",
  "hard",
];
const POINTS_BY_DIFFICULTY: Record<"easy" | "medium" | "hard", number> = {
  easy: 150,
  medium: 250,
  hard: 400,
};

function formatLabel(slug: string) {
  return slug
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pointsForDifficulty(difficulty: string) {
  if (
    difficulty === "easy" ||
    difficulty === "medium" ||
    difficulty === "hard"
  ) {
    return POINTS_BY_DIFFICULTY[difficulty];
  }
  return 0;
}

export function QuestionLibrary() {
  const params = useParams();
  const code = params.code?.toUpperCase();
  const [searchParams] = useSearchParams();
  const hostSecret = searchParams.get("hostSecret");

  const sanitizedHostSecret = hostSecret?.trim() ?? "";

  if (!code) {
    return <Navigate to="/" replace />;
  }

  if (sanitizedHostSecret.length === 0) {
    return <HostSecretError fallbackPath={`/${code}`} />;
  }

  const registerPayload = useMemo(
    () => ({
      type: "register" as const,
      role: "host" as const,
      hostSecret: sanitizedHostSecret,
    }),
    [sanitizedHostSecret]
  );

  const { state, lastError } = useSessionConnection({
    code,
    registerPayload,
  });

  const categories = useMemo(() => {
    if (!state?.categories) {
      return [] as Array<{
        label: string;
        value: string;
        subcategories: Array<{ label: string; value: string }>;
      }>;
    }

    return Object.entries(state.categories).map(([group, subcategories]) => ({
      label: formatLabel(group),
      value: group,
      subcategories: subcategories.map((sub) => ({
        label: formatLabel(sub),
        value: sub,
      })),
    }));
  }, [state?.categories]);

  const usedSlots = useMemo(() => {
    const slots = state?.usedCategorySlots ?? [];
    return new Set(slots.map((slot) => slot.toLowerCase()));
  }, [state?.usedCategorySlots]);

  const activeSlotKey = state?.activeQuestion
    ? `${state.activeQuestion.category}|${state.activeQuestion.difficulty}`.toLowerCase()
    : null;

  const [dismissedQuestionId, setDismissedQuestionId] = useState<string | null>(
    null
  );
  const [modalQuestion, setModalQuestion] = useState<{
    id: string;
    title: string;
    prompt: string;
    choices: string[];
    correctAnswer: string;
    category: string;
    difficulty: string;
    points: number;
    stage: string;
    assignedTo: string | null;
    answeringPlayer: string | null;
  } | null>(null);

  useEffect(() => {
    const active = state?.activeQuestion;

    if (
      !active ||
      !active.correctAnswer ||
      !active.choices ||
      active.choices.length === 0
    ) {
      setModalQuestion(null);
      if (!active) {
        setDismissedQuestionId(null);
      }
      return;
    }

    if (dismissedQuestionId === active.id) {
      return;
    }

    setModalQuestion({
      id: active.id,
      title: active.title,
      prompt: active.prompt,
      choices: active.choices,
      correctAnswer: active.correctAnswer,
      category: active.category,
      difficulty: active.difficulty,
      points: active.points,
      stage: active.stage,
      assignedTo: active.assignedTo?.name ?? null,
      answeringPlayer: active.answeringPlayer?.name ?? null,
    });
  }, [state?.activeQuestion, dismissedQuestionId]);

  const columnTemplate = useMemo(() => {
    if (categories.length === 0) {
      return "1fr";
    }
    return `repeat(${categories.length}, minmax(60px, 1fr))`;
  }, [categories.length]);

  const isInitializing = !state && !lastError;
  const hasError = Boolean(lastError) && !state;

  const handleDismissModal = () => {
    if (modalQuestion) {
      setDismissedQuestionId(modalQuestion.id);
      setModalQuestion(null);
    }
  };

  return (
    <Fragment>
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-100">
        <header className="flex flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <Link
            to={
              sanitizedHostSecret
                ? `/${code}?hostSecret=${sanitizedHostSecret}`
                : `/${code}`
            }
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-500/40 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
          >
            <span aria-hidden>←</span>
            Back to room
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Question Library
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Every slot below can be activated once per game. Points show what
              a correct answer is worth.
            </p>
          </div>
        </header>

        <main className="flex flex-1 flex-col">
          {isInitializing ? (
            <section className="mx-6 mb-10 rounded-2xl bg-slate-900/70 p-6 text-sm text-slate-300">
              Loading categories…
            </section>
          ) : hasError ? (
            <section className="mx-6 mb-10 rounded-2xl bg-slate-900/70 p-6 text-sm text-rose-200">
              {lastError ??
                "Unable to load categories right now. Try refreshing later."}
            </section>
          ) : categories.length === 0 ? (
            <section className="mx-6 mb-10 rounded-2xl bg-slate-900/70 p-6 text-sm text-slate-300">
              No categories are configured for this room yet. Start a game from
              the host console to populate the board.
            </section>
          ) : (
            <section className="flex flex-1 flex-col gap-6 px-6 pb-10">
              <div
                className="grid min-w-full rounded-xl overflow-hidden border-slate-500/30 border"
                style={{ gridTemplateColumns: columnTemplate }}
              >
                {categories.map((category) => (
                  <div
                    key={`header-${category.value}`}
                    className="flex flex-col justify-center items-center gap-1 border-b border-r border-slate-500/30 bg-slate-900/95 px-4 py-4 text-center"
                  >
                    <span className="text-sm font-semibold text-slate-100">
                      {category.label}
                    </span>
                  </div>
                ))}

                {DIFFICULTIES.map((difficulty) => (
                  <Fragment key={difficulty}>
                    {categories.map((category) => {
                      const slotKey =
                        `${category.value}|${difficulty}`.toLowerCase();
                      const used = usedSlots.has(slotKey);
                      const isActive = activeSlotKey === slotKey;
                      const points = pointsForDifficulty(difficulty);

                      return (
                        <div
                          key={slotKey}
                          className={`flex min-h-[160px] items-center justify-center border-b border-r border-slate-500/30 transition ${
                            isActive
                              ? "border-cyan-400/60 bg-cyan-400/10"
                              : used
                              ? "bg-slate-900/10"
                              : "bg-slate-900/70"
                          }`}
                        >
                          <span
                            className={`text-4xl font-semibold tracking-tight md:text-5xl ${
                              used ? "text-slate-800" : "text-slate-100"
                            }`}
                          >
                            {points}
                          </span>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
              <p className="text-center text-xs uppercase tracking-[0.3em] text-slate-500">
                Slots gray out after activation. Reusing the same category and
                difficulty is blocked for the rest of the game.
              </p>
            </section>
          )}
        </main>
      </div>

      {modalQuestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-500/40 bg-slate-950/95 p-8 shadow-xl">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {formatLabel(modalQuestion.category)} •{" "}
                  {formatLabel(modalQuestion.difficulty)} •{" "}
                  {modalQuestion.points} pts
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  {modalQuestion.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleDismissModal}
                className="inline-flex items-center gap-2 rounded-full border border-slate-500/40 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
              >
                <span aria-hidden>✕</span>
                Close
              </button>
            </header>
            <p className="mt-4 text-sm text-slate-300">
              {modalQuestion.prompt}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-slate-500">
              <span>
                Stage:{" "}
                {modalQuestion.stage === "awaitingHostDecision"
                  ? "Awaiting Host Decision"
                  : "Open For Buzz"}
              </span>
              {modalQuestion.assignedTo ? (
                <span>Assigned: {modalQuestion.assignedTo}</span>
              ) : null}
              {modalQuestion.answeringPlayer ? (
                <span>Answering: {modalQuestion.answeringPlayer}</span>
              ) : null}
            </div>
            <ul className="mt-6 grid gap-3">
              {modalQuestion.choices.map((choice, index) => (
                <li
                  key={`${modalQuestion.id}-choice-${index}`}
                  className="rounded-2xl border border-slate-500/40 bg-slate-900/85 px-4 py-4 text-sm text-slate-100"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      Option {String.fromCharCode(65 + index)}
                    </span>
                    <span className="font-medium text-right">{choice}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Fragment>
  );
}
