import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { joinSession } from '../api';
import type { PlayerSession } from '../utils/playerSessionStorage';

type JoinFormProps = {
  code: string;
  onJoin: (session: PlayerSession) => void;
};

export function JoinForm({ code, onJoin }: JoinFormProps) {
  const normalizedCode = code.trim().toUpperCase();
  const [nameInput, setNameInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const joinMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmedName = name.trim();
      const data = await joinSession(normalizedCode, trimmedName);
      return { code: normalizedCode, name: trimmedName, playerId: data.playerId } as PlayerSession;
    },
    onSuccess: (session) => {
      setNameInput('');
      setLocalError(null);
      onJoin(session);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to join the game';
      setLocalError(message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    const trimmedName = nameInput.trim();

    if (!trimmedName) {
      setLocalError('Enter your name to continue');
      return;
    }

    joinMutation.mutate(trimmedName);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-transparent bg-slate-800/70 p-8 transition hover:-translate-y-1 hover:border-slate-500/60 hover:bg-slate-800/90 focus-within:-translate-y-1 focus-within:border-slate-500/60 focus-within:ring-2 focus-within:ring-sky-400/60"
    >
      <h2 className="text-2xl font-semibold tracking-tight">Join</h2>
      <p className="text-sm text-slate-300">
        You&apos;re about to join room <span className="font-semibold text-slate-100">{normalizedCode}</span>.
      </p>
      <label className="grid gap-2 text-sm font-medium text-slate-200">
        Your nickname
        <input
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
          placeholder="Let everyone know who buzzed"
          maxLength={32}
          className="rounded-xl border border-slate-500/40 bg-slate-950/80 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
        />
      </label>
      <button
        type="submit"
        className="mt-auto inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-3 text-base font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={joinMutation.isPending}
      >
        {joinMutation.isPending ? 'Joining…' : 'Buzz in'}
      </button>
      {(localError || joinMutation.isError) && (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {localError ?? 'Something went wrong. Try again.'}
        </p>
      )}
    </form>
  );
}
