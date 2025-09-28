import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { listRooms, RoomOverview, claimShareCode } from "../api";
import { saveHostSecret, getHostSecret } from "../utils/hostSessionStorage";
import { useNavigate } from "react-router-dom";

export function AvailableRooms() {
  const navigate = useNavigate();
  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: listRooms,
    refetchInterval: 5000,
    staleTime: 5000,
  });

  const rooms: RoomOverview[] = roomsQuery.data ?? [];
  const shareClaimMutation = useMutation({
    mutationFn: ({ shareCode }: { shareCode: string }) =>
      claimShareCode(shareCode),
  });
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});
  const [shareErrors, setShareErrors] = useState<Record<string, string | null>>(
    {}
  );

  const handleShareInputChange = (roomCode: string, next: string) => {
    setShareInputs((prev) => ({ ...prev, [roomCode]: next }));
    setShareErrors((prev) => ({ ...prev, [roomCode]: null }));
  };

  const submitShareCode = (roomCode: string) => {
    const trimmed = (shareInputs[roomCode] ?? "").trim();
    if (trimmed.length !== 4) {
      setShareErrors((prev) => ({
        ...prev,
        [roomCode]: "Enter the 4-digit code",
      }));
      return;
    }

    shareClaimMutation.mutate(
      { shareCode: trimmed },
      {
        onSuccess: (result) => {
          saveHostSecret(result.code, result.hostSecret);
          navigate(`/${result.code}/questions?hostSecret=${result.hostSecret}`);
        },
        onError: () => {
          setShareErrors((prev) => ({
            ...prev,
            [roomCode]: "Code not found. Ask the host to confirm it.",
          }));
        },
      }
    );
  };
  return (
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

        <div>
          <button
            className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => roomsQuery.refetch()}
            disabled={roomsQuery.isFetching}
          >
            REFRESH
          </button>
        </div>
      </header>
      <div className="rounded-2xl border border-slate-500/30 bg-slate-950/70">
        {roomsQuery.isLoading ? (
          <p className="px-6 py-10 text-sm text-slate-300">Loading rooms...</p>
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
                      room.questionActive ? "text-amber-200" : "text-slate-500"
                    }
                  >
                    {room.questionActive
                      ? "Question in progress"
                      : "Waiting for next question"}
                  </span>
                  {room.shareActive ? (
                    <span className="text-cyan-200">Board share active</span>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                      onClick={() => navigate(`/${room.code}`)}
                    >
                      Join room
                    </button>
                  </div>
                </div>

                {room.shareActive ? (
                  <form
                    className="flex flex-col sm:flex-row sm:items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitShareCode(room.code);
                    }}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={shareInputs[room.code] ?? ""}
                      onChange={(event) => {
                        const next = event.target.value
                          .replace(/[^0-9]/g, "")
                          .slice(0, 4);
                        handleShareInputChange(room.code, next);
                      }}
                      className="w-28 rounded-xl border border-slate-500/40 bg-slate-900/80 px-3 py-1 text-center text-lg font-semibold tracking-[0.4em] text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
                      placeholder="0000"
                    />
                    <button
                      type="submit"
                      disabled={shareClaimMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {shareClaimMutation.isPending
                        ? "Unlocking..."
                        : "Unlock board"}
                    </button>
                    {shareErrors[room.code] ? (
                      <span className="text-xs text-rose-200 sm:ml-3">
                        {shareErrors[room.code]}
                      </span>
                    ) : null}
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
