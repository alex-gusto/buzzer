import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import {
  activateQuestion,
  cancelActiveQuestion,
  createSession,
  markQuestionResult,
  openQuestionForBuzzers,
  setTurn,
  getTriviaCategories,
} from '../api';
import { useSessionConnection } from '../hooks/useSessionConnection';
import type { RoomSnapshot, SocketStatus } from '../types';

type HostSession = {
  code: string;
  hostSecret: string;
};

type HostViewProps = {
  onExit?: () => void;
};

const statusStyles: Record<SocketStatus, string> = {
  idle: 'bg-slate-500/20 text-slate-100',
  connecting: 'bg-amber-500/20 text-amber-200',
  open: 'bg-emerald-500/20 text-emerald-200',
  closed: 'bg-rose-500/20 text-rose-200',
};

type ActivateQuestionVariables = {
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
};

function slugifyCategory(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function HostView({ onExit }: HostViewProps) {
  const [session, setSession] = useState<HostSession | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const navigate = useNavigate();

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }

    const timeout = window.setTimeout(() => setCopyStatus('idle'), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const handleExit = () => {
    if (onExit) {
      onExit();
      return;
    }

    navigate('/');
  };

  const handleCopyCode = async () => {
    if (!session?.code) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(session.code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = session.code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopyStatus('copied');
    } catch (error) {
      console.error('Failed to copy room code', error);
      setCopyStatus('error');
    }
  };

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (data) => {
      setSession(data);
      setActionError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to create a game right now';
      setActionError(message);
    },
  });

  const registerPayload = useMemo(
    () =>
      session
        ? ({
            type: 'register',
            role: 'host',
            hostSecret: session.hostSecret,
          } as const)
        : undefined,
    [session],
  );

  const { state, status, lastError } = useSessionConnection({
    code: session?.code ?? null,
    registerPayload,
  });

  const players = useMemo(() => {
    if (!state) {
      return [] as RoomSnapshot['players'];
    }

    return [...state.players].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.joinedAt - b.joinedAt;
    });
  }, [state]);

  const activeQuestion = state?.activeQuestion ?? null;
  const lastResult = state?.lastResult ?? null;
  const currentTurn = state?.currentTurn ?? null;

  const { data: categoriesData } = useQuery({
    queryKey: ['trivia-categories'],
    queryFn: getTriviaCategories,
    staleTime: 1000 * 60 * 60,
    enabled: Boolean(session),
  });

  const categoryOptions = useMemo(() => {
    if (!categoriesData) {
      return [] as Array<{ label: string; value: string }>;
    }

    const options: Array<{ label: string; value: string }> = [];

    for (const [group, subCategories] of Object.entries(categoriesData)) {
      const groupSlug = slugifyCategory(group);
      options.push({ label: group, value: groupSlug });

      subCategories
        .map((sub) => ({ label: `${group} · ${sub}`, value: slugifyCategory(sub) }))
        .forEach((option) => options.push(option));
    }

    return options;
  }, [categoriesData]);

  const [selectedCategory, setSelectedCategory] = useState<string | ''>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');

  const setTurnMutation = useMutation<void, Error, string>({
    mutationFn: async (playerId: string) => {
      if (!session) {
        throw new Error('No active session');
      }
      await setTurn(session.code, session.hostSecret, playerId);
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Unable to update turn');
    },
  });

  const activateQuestionMutation = useMutation<void, Error, ActivateQuestionVariables>({
    mutationFn: async (input: ActivateQuestionVariables) => {
      if (!session) {
        throw new Error('No active session');
      }
      await activateQuestion(session.code, session.hostSecret, input);
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Unable to activate question');
    },
  });

  const openBuzzersMutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error('No active session');
      }
      await openQuestionForBuzzers(session.code, session.hostSecret);
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Unable to open buzzers');
    },
  });

  const markCorrectMutation = useMutation<void, Error, string | undefined>({
    mutationFn: async (playerId) => {
      if (!session) {
        throw new Error('No active session');
      }
      await markQuestionResult(session.code, session.hostSecret, 'correct', { playerId });
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Unable to mark correct');
    },
  });

  const markIncorrectMutation = useMutation<void, Error, boolean>({
    mutationFn: async (openBuzzers) => {
      if (!session) {
        throw new Error('No active session');
      }
      await markQuestionResult(session.code, session.hostSecret, 'incorrect', { openBuzzers });
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Unable to mark incorrect');
    },
  });

  const cancelQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error('No active session');
      }
      await cancelActiveQuestion(session.code, session.hostSecret);
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Unable to cancel question');
    },
  });

  const anyMutationPending =
    createMutation.isPending ||
    setTurnMutation.isPending ||
    activateQuestionMutation.isPending ||
    openBuzzersMutation.isPending ||
    markCorrectMutation.isPending ||
    markIncorrectMutation.isPending ||
    cancelQuestionMutation.isPending;

  const activeQuestionStatus = useMemo(() => {
    if (!activeQuestion) {
      return null;
    }

    if (activeQuestion.stage === 'awaitingHostDecision') {
      return activeQuestion.answeringPlayer
        ? `Reviewing answer from ${activeQuestion.answeringPlayer.name}`
        : 'Waiting for the assigned player to answer';
    }

    if (activeQuestion.stage === 'openForBuzz') {
      return 'Buzzers are open';
    }

    return null;
  }, [activeQuestion]);

  const canActivateQuestion = Boolean(session && !anyMutationPending && !activeQuestion && currentTurn);

  const canMarkCorrect = Boolean(
    activeQuestion &&
      activeQuestion.stage === 'awaitingHostDecision' &&
      activeQuestion.answeringPlayer,
  );

  const canOpenBuzzers = Boolean(
    activeQuestion &&
      activeQuestion.stage === 'awaitingHostDecision' &&
      !openBuzzersMutation.isPending,
  );

  const canCloseIncorrect = Boolean(activeQuestion && !markIncorrectMutation.isPending);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-[28px] bg-slate-950/85 px-6 py-8 shadow-glow backdrop-blur">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-500/40 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
          >
            <span aria-hidden>←</span>
            Back
          </button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Host Console</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Guide the game, queue questions, and confirm answers.
            </p>
          </div>
        </header>

        {!session ? (
          <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-slate-500/40 bg-slate-900/60 p-12 text-center">
            <p className="text-lg text-slate-200">Ready to run the show?</p>
            <button
              type="button"
              className="mt-6 inline-flex items-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-6 py-3 text-base font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create Game'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-2xl bg-slate-900/70 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Room code</span>
                <p className="mt-2 text-4xl font-semibold tracking-[0.35em] text-slate-100 md:text-5xl">
                  {session.code}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3 text-sm text-slate-100">
                <div className="rounded-full">
                  <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${statusStyles[status]}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-500/40 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-300/60 hover:bg-slate-800/60"
                >
                  <span>{copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Copy failed' : 'Copy code'}</span>
                  <span aria-hidden className="text-base">⧉</span>
                </button>
              </div>
            </section>

            <section className="grid gap-4 rounded-2xl bg-slate-900/70 p-6 md:grid-cols-[minmax(220px,280px),1fr] md:items-start">
              <div className="flex flex-col gap-3">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Current turn</span>
                <strong className="text-2xl text-slate-100">{currentTurn?.name ?? '—'}</strong>
                <p className="text-sm text-slate-300">{activeQuestionStatus ?? 'Waiting for the next question.'}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => cancelQuestionMutation.mutate()}
                    disabled={cancelQuestionMutation.isPending || !activeQuestion}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel question
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Category
                  <select
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value as typeof selectedCategory)}
                    className="rounded-xl border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
                  >
                    <option value="">Any category</option>
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Difficulty
                  <select
                    value={selectedDifficulty}
                    onChange={(event) =>
                      setSelectedDifficulty((event.target.value as typeof selectedDifficulty) || '')
                    }
                    className="rounded-xl border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
                  >
                    <option value="">Any difficulty</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const difficulty = selectedDifficulty ? (selectedDifficulty as 'easy' | 'medium' | 'hard') : undefined;
                    void activateQuestionMutation.mutateAsync({
                      category: selectedCategory || undefined,
                      difficulty,
                    });
                  }}
                  disabled={!canActivateQuestion}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Activate question
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openBuzzersMutation.mutate()}
                    disabled={!canOpenBuzzers}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Open buzzers
                  </button>
                  <button
                    type="button"
                    onClick={() => markIncorrectMutation.mutate(false)}
                    disabled={!canCloseIncorrect}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Mark incorrect
                  </button>
                  <button
                    type="button"
                    onClick={() => markIncorrectMutation.mutate(true)}
                    disabled={!activeQuestion || activeQuestion.stage !== 'awaitingHostDecision' || markIncorrectMutation.isPending}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Pass to buzzers
                  </button>
                  <button
                    type="button"
                    onClick={() => markCorrectMutation.mutate(activeQuestion?.answeringPlayer?.playerId)}
                    disabled={!canMarkCorrect}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Mark correct
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-slate-900/70 p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-semibold text-slate-100">Players</h3>
                <span className="text-sm text-slate-400">{players.length} joined</span>
              </div>
              <ul className="mt-4 grid gap-3">
                {players.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-slate-500/40 bg-slate-900/40 px-6 py-4 text-center text-sm text-slate-400">
                    Share the code so players can join.
                  </li>
                ) : (
                  players.map((player) => (
                    <li
                      key={player.id}
                      className={`flex items-center justify-between rounded-xl px-5 py-4 text-sm text-slate-100 transition ${
                        currentTurn?.playerId === player.id
                          ? 'bg-cyan-500/20 border border-cyan-400/30'
                          : 'bg-slate-800/60'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{player.name}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          {currentTurn?.playerId === player.id ? 'Selecting now' : 'Waiting'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-slate-100">{player.score} pts</span>
                        <button
                          type="button"
                          onClick={() => setTurnMutation.mutate(player.id)}
                          disabled={setTurnMutation.isPending || currentTurn?.playerId === player.id}
                          className="inline-flex items-center justify-center rounded-full border border-slate-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Make turn
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-2xl bg-slate-900/70 p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-semibold text-slate-100">Active question</h3>
                {activeQuestion ? (
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {activeQuestion.category} • {activeQuestion.points} pts
                  </span>
                ) : null}
              </div>
              {activeQuestion ? (
                <div className="mt-4 space-y-3 rounded-xl border border-slate-500/30 bg-slate-900/80 px-6 py-5">
                  <h4 className="text-lg font-semibold text-slate-100">{activeQuestion.title}</h4>
                  <p className="text-sm text-slate-300">{activeQuestion.prompt}</p>
                  <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>Assigned to {activeQuestion.assignedTo?.name ?? '—'}</span>
                    <span>
                      Answering {activeQuestion.answeringPlayer?.name ?? (activeQuestion.stage === 'openForBuzz' ? 'Waiting for buzz' : '—')}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-slate-500/40 bg-slate-900/40 px-6 py-5 text-sm text-slate-400">
                  Select a question when the player is ready.
                </p>
              )}
            </section>

            {lastResult ? (
              <section className="rounded-2xl bg-slate-900/70 p-6">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xl font-semibold text-slate-100">Last result</h3>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {lastResult.category} • {lastResult.points} pts
                  </span>
                </div>
                <div className="mt-4 space-y-3 rounded-xl border border-slate-500/30 bg-slate-900/80 px-6 py-5">
                  <h4 className="text-lg font-semibold text-slate-100">{lastResult.title}</h4>
                  <p className="text-sm text-slate-300">
                    {lastResult.answeredCorrectly ? 'Answered correctly' : 'Answered incorrectly'} by{' '}
                    {lastResult.answeredBy?.name ?? 'unknown player'}. Awarded {lastResult.pointsAwarded} pts.
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Correct answer: {lastResult.correctAnswer}
                  </p>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl bg-slate-900/70 p-6">
              <h3 className="text-xl font-semibold text-slate-100">Trivia categories</h3>
              <p className="mt-2 text-sm text-slate-300">
                Choose a category and difficulty to queue the next clue. You can always leave them set to "Any" for a random pick.
              </p>
              <div className="mt-4 grid gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>Category: {categoryOptions.find((opt) => opt.value === selectedCategory)?.label ?? 'Any'}</span>
                <span>Difficulty: {selectedDifficulty || 'Any'}</span>
              </div>
            </section>
          </div>
        )}

        {(actionError || lastError) && (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {actionError ?? lastError}
          </p>
        )}
      </div>
    </div>
  );
}
