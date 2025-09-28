import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createSession } from "../api";
import { AvailableRooms } from "../components";

export function HomePage() {
  const navigate = useNavigate();
  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      navigate(`/${session.code}?hostSecret=${session.hostSecret}`);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900/80 via-slate-900/95 to-slate-950 pb-16 pt-24 text-slate-100 gap-6 grid">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 rounded-[32px] bg-slate-950/85 px-8 py-14 shadow-glow backdrop-blur">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">
            Buzzer Party
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Spin up a trivia room, share the invite link, and see who buzzes in
            first.
          </p>
        </header>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <button
            type="button"
            onClick={() => createSessionMutation.mutate()}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-6 py-4 text-lg font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createSessionMutation.isPending}
          >
            {createSessionMutation.isPending ? "Creating..." : "Create a game"}
          </button>
          {createSessionMutation.isError ? (
            <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
              Something went wrong. Try again.
            </p>
          ) : null}
        </div>
      </div>

      <AvailableRooms />
    </div>
  );
}
