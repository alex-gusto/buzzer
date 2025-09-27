import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { joinSession } from '../api';
import type { PlayerSession } from '../utils/playerSessionStorage';

type JoinFormProps = {
  initialCode?: string;
  onJoin: (session: PlayerSession) => void;
};

export function JoinForm({ initialCode, onJoin }: JoinFormProps) {
  const [codeInput, setCodeInput] = useState(() => initialCode?.toUpperCase() ?? '');
  const [nameInput, setNameInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      setCodeInput(initialCode.toUpperCase());
    }
  }, [initialCode]);

  const joinMutation = useMutation({
    mutationFn: async (input: { code: string; name: string }) => {
      const code = input.code.trim().toUpperCase();
      const name = input.name.trim();
      const data = await joinSession(code, name);
      return { code, name, playerId: data.playerId } as PlayerSession;
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

    const trimmedCode = codeInput.trim().toUpperCase();
    const trimmedName = nameInput.trim();

    if (!trimmedCode) {
      setLocalError('Enter a game code to continue');
      return;
    }

    if (!trimmedName) {
      setLocalError('Enter your name to continue');
      return;
    }

    joinMutation.mutate({ code: trimmedCode, name: trimmedName });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-transparent bg-slate-800/70 p-8 transition hover:-translate-y-1 hover:border-slate-500/60 hover:bg-slate-800/90 focus-within:-translate-y-1 focus-within:border-slate-500/60 focus-within:ring-2 focus-within:ring-sky-400/60"
    >
      <h2 className="text-2xl font-semibold tracking-tight">Join</h2>
      <p className="text-slate-300">Enter the code from the host to jump straight into the action.</p>
      <label className="grid gap-2 text-sm font-medium text-slate-200">
        Game code
        <input
          value={codeInput}
          onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
          placeholder="ABCD"
          maxLength={6}
          className="rounded-xl border border-slate-500/40 bg-slate-950/80 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-200">
        Your name
        <input
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
          placeholder="Your nickname"
          maxLength={32}
          className="rounded-xl border border-slate-500/40 bg-slate-950/80 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
        />
      </label>
      <button
        type="submit"
        className="mt-auto inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-3 text-base font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={joinMutation.isPending}
      >
        {joinMutation.isPending ? 'Joining…' : 'Join game'}
      </button>
      {(localError || joinMutation.isError) && (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {localError ?? 'Something went wrong. Try again.'}
        </p>
      )}
    </form>
  );
}
