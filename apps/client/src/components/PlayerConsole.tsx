import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { leaveSession } from '../api';
import { useSessionConnection } from '../hooks/useSessionConnection';
import type { RoomSnapshot, SocketStatus } from '../types';
import { clearPlayerSession } from '../utils/playerSessionStorage';
import type { PlayerSession } from '../utils/playerSessionStorage';

const statusStyles: Record<SocketStatus, string> = {
  idle: 'bg-slate-500/20 text-slate-100',
  connecting: 'bg-amber-500/20 text-amber-200',
  open: 'bg-emerald-500/20 text-emerald-200',
  closed: 'bg-rose-500/20 text-rose-200',
};

type PlayerConsoleProps = {
  session: PlayerSession;
  onExit?: () => void;
};

export function PlayerConsole({ session, onExit }: PlayerConsoleProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);

  const registerPayload = useMemo(
    () => ({
      type: 'register' as const,
      role: 'player' as const,
      playerId: session.playerId,
    }),
    [session.playerId],
  );

  const { state, status, lastError, sendBuzz } = useSessionConnection({
    code: session.code,
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
  const hasAttempted = activeQuestion?.attemptedPlayerIds.includes(session.playerId) ?? false;
  const isAnswering = activeQuestion?.answeringPlayer?.playerId === session.playerId;

  const canBuzz = Boolean(state?.questionActive && !hasAttempted);

  const playerStatusMessage = useMemo(() => {
    if (isAnswering) {
      return 'Host is reviewing your answer.';
    }

    if (canBuzz) {
      return 'Buzz in if you know it!';
    }

    if (activeQuestion) {
      if (hasAttempted) {
        return 'You already attempted this question.';
      }

      if (activeQuestion.stage === 'awaitingHostDecision') {
        return 'Stand by while the host resolves the current answer.';
      }

      return 'Waiting for the host to open the buzzers.';
    }

    if (state?.currentTurn?.playerId === session.playerId) {
      return 'Host will activate your question shortly.';
    }

    if (state?.currentTurn) {
      return `${state.currentTurn.name} is up next.`;
    }

    return 'Waiting for the game to begin.';
  }, [activeQuestion, canBuzz, hasAttempted, isAnswering, state?.currentTurn, session.playerId]);

  const executeLeave = () => {
    void leaveSession(session.code, session.playerId).catch(() => {
      // best effort; leaving should not block the client cleanup
    });

    clearPlayerSession(session.code, session.playerId);
    queryClient.removeQueries({
      queryKey: ['player-session', session.code.toUpperCase(), session.playerId],
      exact: true,
    });

    if (onExit) {
      onExit();
    }

    navigate('/', { replace: true });
  };

  const handleConfirmLeave = () => {
    setIsConfirmingLeave(false);
    executeLeave();
  };

  const handleCancelLeave = () => {
    setIsConfirmingLeave(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-[32px] bg-slate-950/90 px-6 py-8 shadow-glow backdrop-blur">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <button
            type="button"
            onClick={() => setIsConfirmingLeave(true)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-500/40 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
          >
            <span aria-hidden>←</span>
            Leave
          </button>
          <div className="flex flex-col gap-1 text-center md:text-left">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Nick:</span>
            <h2 className="text-3xl font-semibold tracking-[0.35em] text-slate-100 md:text-4xl">
              {session.name}
            </h2>
            <span className="text-sm text-slate-400">You are playing at {session.code} room</span>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium capitalize ${statusStyles[status]}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {status}
          </span>
        </header>

        <section className="rounded-2xl bg-slate-900/70 p-6 text-center">
          <p className="text-sm text-slate-300">{playerStatusMessage}</p>
          <button
            type="button"
            onClick={sendBuzz}
            disabled={!canBuzz}
            className="mt-6 flex h-48 w-full items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-rose-500 to-rose-700 text-3xl font-bold text-white shadow-[0_20px_50px_rgba(244,63,94,0.35)] transition hover:brightness-110 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-40 md:h-60"
          >
            Buzz!
          </button>
        </section>

        {activeQuestion ? (
          <section className="rounded-2xl bg-slate-900/70 p-6 text-left">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xl font-semibold text-slate-100">Current question</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {activeQuestion.category} • {activeQuestion.points} pts
              </span>
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-100">{activeQuestion.title}</p>
            <p className="mt-2 text-sm text-slate-300">{activeQuestion.prompt}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>Turn: {state?.currentTurn?.name ?? '—'}</span>
              <span>
                Answering: {activeQuestion.answeringPlayer?.name ?? (activeQuestion.stage === 'openForBuzz' ? 'Waiting for buzz' : '—')}
              </span>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl bg-slate-900/70 p-6">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xl font-semibold text-slate-100">Scoreboard</h3>
            <span className="text-sm text-slate-400">{players.length} players</span>
          </div>
          <ul className="mt-4 grid gap-2">
            {players.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-500/40 bg-slate-900/40 px-6 py-4 text-center text-sm text-slate-400">
                Waiting for the host to add players.
              </li>
            ) : (
              players.map((player) => (
                <li
                  key={player.id}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                    player.id === session.playerId
                      ? 'border border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
                      : 'border border-slate-500/30 bg-slate-900/60 text-slate-100'
                  }`}
                >
                  <span className="font-medium">{player.name}</span>
                  <span className="font-semibold">{player.score} pts</span>
                </li>
              ))
            )}
          </ul>
        </section>

        {lastResult ? (
          <section className="rounded-2xl bg-slate-900/70 p-6 text-left">
            <h3 className="text-xl font-semibold text-slate-100">Last result</h3>
            <p className="mt-2 text-sm text-slate-300">
              {lastResult.answeredCorrectly ? 'Correct answer' : 'Incorrect answer'} by{' '}
              {lastResult.answeredBy?.name ?? 'unknown player'}. Awarded {lastResult.pointsAwarded} pts.
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
              Correct answer: {lastResult.correctAnswer}
            </p>
          </section>
        ) : null}

        {lastError && (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {lastError}
          </p>
        )}
      </div>
      {isConfirmingLeave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-500/40 bg-slate-950/95 p-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-slate-100">Leave this game?</h2>
            <p className="mt-3 text-sm text-slate-300">
              You'll disappear from the scoreboard right away. You can rejoin later with the room code if you change your mind.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelLeave}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-500/40 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
              >
                Stay in game
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:from-rose-400 hover:to-amber-400"
              >
                Leave game
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
