import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  claimShareCode,
  createSession,
  listRooms,
  RoomOverview,
} from "../api";
import { getHostSecret, saveHostSecret } from "../utils/hostSessionStorage";

export function HomePage() {
  const navigate = useNavigate();
  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      navigate(`/${session.code}?hostSecret=${session.hostSecret}`);
    },
  });

  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: listRooms,
    refetchInterval: 5000,
    staleTime: 5000,
  });

  const rooms: RoomOverview[] = roomsQuery.data ?? [];
  const shareActiveRooms = useMemo(
    () => rooms.filter((room) => room.shareActive),
    [rooms]
  );
  const activeShareKey = useMemo(() => {
    if (shareActiveRooms.length === 0) {
      return null;
    }
    return shareActiveRooms
      .map((room) => `${room.code}:${room.shareExpiresAt ?? 0}`)
      .sort()
      .join("|");
  }, [shareActiveRooms]);

  const shareClaimMutation = useMutation({
    mutationFn: (shareCode: string) => claimShareCode(shareCode),
  });

  const [isSharePromptOpen, setIsSharePromptOpen] = useState(false);
  const [shareCodeInput, setShareCodeInput] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [acknowledgedShareKey, setAcknowledgedShareKey] = useState<string | null>(null);

  useEffect(() => {
    if (activeShareKey && activeShareKey !== acknowledgedShareKey) {
      if (!isSharePromptOpen) {
        setIsSharePromptOpen(true);
      }
      return;
    }

    if (!activeShareKey) {
      if (isSharePromptOpen) {
        setIsSharePromptOpen(false);
      }
      if (shareCodeInput !== "") {
        setShareCodeInput("");
      }
      if (shareError !== null) {
        setShareError(null);
      }
      if (acknowledgedShareKey !== null) {
        setAcknowledgedShareKey(null);
      }
      shareClaimMutation.reset();
    }
  }, [
    acknowledgedShareKey,
    activeShareKey,
    isSharePromptOpen,
    shareClaimMutation,
    shareCodeInput,
    shareError,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900/80 via-slate-900/95 to-slate-950 pb-16 pt-24 text-slate-100">
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
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-[28px] border border-slate-500/30 bg-slate-950/70 px-6 py-8 text-slate-100 backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Available rooms
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Pick a room below to join instantly or create a new one above.
            </p>
          </div>
        </header>
        <div className="rounded-2xl border border-slate-500/30 bg-slate-950/70">
          {roomsQuery.isLoading ? (
            <p className="px-6 py-10 text-sm text-slate-300">
              Loading rooms...
            </p>
          ) : roomsQuery.isError ? (
            <p className="px-6 py-10 text-sm text-rose-200">
              Unable to load rooms right now. Try refreshing shortly.
            </p>
          ) : rooms.length === 0 ? (
            <p className="px-6 py-10 text-sm text-slate-300">
              No open rooms at the moment. Create one above to get started and
              invite players.
            </p>
          ) : (
            <ul className="divide-y divide-slate-500/20">
              {rooms.map((room) => (
                <li
                  key={room.code}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                >
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      Room code
                    </span>
                    <span className="text-3xl font-semibold tracking-[0.3em] text-slate-100">
                      {room.code}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300">
                    <span>
                      {room.playerCount}{" "}
                      {room.playerCount === 1 ? "player" : "players"}
                    </span>
                    <span
                      className={
                        room.hostOnline ? "text-emerald-200" : "text-slate-500"
                      }
                    >
                      {room.hostOnline ? "Host online" : "Host offline"}
                    </span>
                    <span
                      className={
                        room.questionActive
                          ? "text-amber-200"
                          : "text-slate-500"
                      }
                    >
                      {room.questionActive
                        ? "Question in progress"
                        : "Waiting for next question"}
                    </span>
                    {room.shareActive ? (
                      <span className="text-cyan-200">
                        Board share active
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const hostSecret = getHostSecret(room.code);
                      if (!hostSecret) {
                        return null;
                      }

                      return (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/${room.code}/questions?hostSecret=${hostSecret}`
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-500/40 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/10"
                        >
                          Open board
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                      onClick={() => navigate(`/${room.code}`)}
                    >
                      Join room
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {isSharePromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-500/40 bg-slate-950/95 p-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-slate-100">Enter share code</h2>
            <p className="mt-3 text-sm text-slate-300">
              A host just broadcast a 4-digit code. Enter it below to open their question board on this device.
            </p>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setShareError(null);
                const trimmed = shareCodeInput.trim();
                if (trimmed.length !== 4) {
                  setShareError("Enter the 4-digit code");
                  return;
                }
                shareClaimMutation.mutate(trimmed, {
                  onSuccess: (result) => {
                    saveHostSecret(result.code, result.hostSecret);
                    setIsSharePromptOpen(false);
                    setShareCodeInput("");
                    setShareError(null);
                    if (activeShareKey) {
                      setAcknowledgedShareKey(activeShareKey);
                    }
                    navigate(
                      `/${result.code}/questions?hostSecret=${result.hostSecret}`
                    );
                  },
                  onError: () => {
                    setShareError("Code not found. Ask the host to confirm it.");
                  },
                });
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={shareCodeInput}
                onChange={(event) => {
                  const next = event.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                  setShareCodeInput(next);
                }}
                className="w-full rounded-2xl border border-slate-500/40 bg-slate-900/80 px-4 py-3 text-center text-3xl font-semibold tracking-[0.5em] text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
                placeholder="0000"
                autoFocus
              />
              {shareError ? (
                <p className="text-sm text-rose-200">{shareError}</p>
              ) : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsSharePromptOpen(false);
                    setShareCodeInput("");
                    setShareError(null);
                    if (activeShareKey) {
                      setAcknowledgedShareKey(activeShareKey);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-500/40 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
                >
                  Maybe later
                </button>
                <button
                  type="submit"
                  disabled={shareClaimMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {shareClaimMutation.isPending ? "Checking..." : "Unlock board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
