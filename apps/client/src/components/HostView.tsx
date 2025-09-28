import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  activateQuestion,
  cancelActiveQuestion,
  destroySession,
  markQuestionResult,
  openQuestionForBuzzers,
  setTurn,
  getTriviaCategories,
} from "../api";
import { useSessionConnection } from "../hooks/useSessionConnection";
import type { RoomSnapshot, SocketStatus } from "../types";
import {
  HostActiveQuestionCard,
  HostAvailableSlotsCard,
  HostLastResultCard,
  HostPlayersList,
  HostRoomSummary,
  HostSession,
  HostTurnControls,
} from "./host";
import { clearHostSecret, saveHostSecret } from "../utils/hostSessionStorage";

type HostViewProps = {
  onExit?: () => void;
};

const statusStyles: Record<SocketStatus, string> = {
  idle: "bg-slate-500/20 text-slate-100",
  connecting: "bg-amber-500/20 text-amber-200",
  open: "bg-emerald-500/20 text-emerald-200",
  closed: "bg-rose-500/20 text-rose-200",
};

type ActivateQuestionVariables = {
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
};

type CategoryMap = Record<string, string[]>;

const DIFFICULTIES: Array<"easy" | "medium" | "hard"> = [
  "easy",
  "medium",
  "hard",
];

function formatCategoryLabel(slug: string) {
  return slug
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function HostView({ onExit }: HostViewProps) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const code = params.code?.toUpperCase() ?? null;
  const hostSecretParam = searchParams.get("hostSecret");

  const [session, setSession] = useState<HostSession | null>(() =>
    code && hostSecretParam ? { code, hostSecret: hostSecretParam } : null
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (code && hostSecretParam) {
      setSession({ code, hostSecret: hostSecretParam });
      return;
    }

    setSession(null);
  }, [code, hostSecretParam]);

  useEffect(() => {
    if (session) {
      saveHostSecret(session.code, session.hostSecret);
    }
  }, [session]);

  const handleExit = () => {
    if (onExit) {
      onExit();
      return;
    }

    navigate("/");
  };

  const inviteLink = session ? `${origin}/${session.code}` : "";
  const boardLink = session
    ? `${origin}/${session.code}/questions?hostSecret=${session.hostSecret}`
    : "";

  const registerPayload = useMemo(
    () =>
      session
        ? ({
            type: "register",
            role: "host",
            hostSecret: session.hostSecret,
          } as const)
        : undefined,
    [session]
  );

  const { state, status, lastError } = useSessionConnection({
    code: session?.code ?? null,
    registerPayload,
  });

  const players = useMemo(() => {
    if (!state) {
      return [] as RoomSnapshot["players"];
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

  const inlineCategories = state?.categories ?? null;
  const usedCategorySlots = useMemo(() => {
    const slots = state?.usedCategorySlots ?? [];
    return new Set(slots.map((slot) => slot.toLowerCase()));
  }, [state?.usedCategorySlots]);

  const { data: categoriesFallback } = useQuery<CategoryMap>({
    queryKey: ["trivia-categories"],
    queryFn: getTriviaCategories,
    staleTime: 1000 * 60 * 60,
    enabled: Boolean(session) && !inlineCategories,
  });

  const categoriesData: CategoryMap | null =
    inlineCategories ?? categoriesFallback ?? null;

  const categoryOptions = useMemo(() => {
    if (!categoriesData) {
      return [] as Array<{
        label: string;
        value: string;
        availableDifficulties: Array<"easy" | "medium" | "hard">;
      }>;
    }

    const options: Array<{
      label: string;
      value: string;
      availableDifficulties: Array<"easy" | "medium" | "hard">;
    }> = [];

    const addOption = (value: string, label: string) => {
      const available = DIFFICULTIES.filter(
        (difficulty) =>
          !usedCategorySlots.has(`${value}|${difficulty}`.toLowerCase())
      );

      if (available.length > 0) {
        options.push({ label, value, availableDifficulties: available });
      }
    };

    for (const [group] of Object.entries(categoriesData) as Array<
      [string, string[]]
    >) {
      const groupLabel = formatCategoryLabel(group);
      addOption(group, groupLabel);
    }

    return options;
  }, [categoriesData, usedCategorySlots]);

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    "easy" | "medium" | "hard" | ""
  >("");

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (selectedCategory !== "") {
        setSelectedCategory("");
      }
      return;
    }

    const exists = categoryOptions.some(
      (option) => option.value === selectedCategory
    );
    if (!exists) {
      setSelectedCategory(categoryOptions[0]?.value ?? "");
    }
  }, [categoryOptions, selectedCategory]);

  const availableDifficulties = useMemo(() => {
    if (!selectedCategory) {
      return [] as Array<"easy" | "medium" | "hard">;
    }

    const option = categoryOptions.find(
      (item) => item.value === selectedCategory
    );
    return option?.availableDifficulties ?? [];
  }, [categoryOptions, selectedCategory]);

  useEffect(() => {
    if (
      !availableDifficulties.includes(
        selectedDifficulty as "easy" | "medium" | "hard"
      )
    ) {
      setSelectedDifficulty(availableDifficulties[0] ?? "");
    }
  }, [availableDifficulties, selectedDifficulty]);

  const setTurnMutation = useMutation<void, Error, string>({
    mutationFn: async (playerId: string) => {
      if (!session) {
        throw new Error("No active session");
      }
      await setTurn(session.code, session.hostSecret, playerId);
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Unable to update turn"
      );
    },
  });

  const activateQuestionMutation = useMutation<
    void,
    Error,
    ActivateQuestionVariables
  >({
    mutationFn: async (input: ActivateQuestionVariables) => {
      if (!session) {
        throw new Error("No active session");
      }
      await activateQuestion(session.code, session.hostSecret, input);
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Unable to activate question"
      );
    },
  });

  const openBuzzersMutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error("No active session");
      }
      await openQuestionForBuzzers(session.code, session.hostSecret);
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Unable to open buzzers"
      );
    },
  });

  const markCorrectMutation = useMutation<void, Error, string | undefined>({
    mutationFn: async (playerId) => {
      if (!session) {
        throw new Error("No active session");
      }
      await markQuestionResult(session.code, session.hostSecret, "correct", {
        playerId,
      });
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Unable to mark correct"
      );
    },
  });

  const markIncorrectMutation = useMutation<void, Error, boolean>({
    mutationFn: async (openBuzzers) => {
      if (!session) {
        throw new Error("No active session");
      }
      await markQuestionResult(session.code, session.hostSecret, "incorrect", {
        openBuzzers,
      });
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Unable to mark incorrect"
      );
    },
  });

  const cancelQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error("No active session");
      }
      await cancelActiveQuestion(session.code, session.hostSecret);
    },
    onSuccess: () => setActionError(null),
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Unable to cancel question"
      );
    },
  });

  const destroySessionMutation = useMutation<void, Error, HostSession>({
    mutationFn: async (payload) =>
      destroySession(payload.code, payload.hostSecret),
    onSuccess: (_, payload) => {
      clearHostSecret(payload.code);
      setShowDestroyConfirm(false);
      setActionError(null);
      if (onExit) {
        onExit();
      }
      navigate("/", { replace: true });
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Unable to end the game"
      );
    },
  });

  const anyMutationPending =
    setTurnMutation.isPending ||
    activateQuestionMutation.isPending ||
    openBuzzersMutation.isPending ||
    markCorrectMutation.isPending ||
    markIncorrectMutation.isPending ||
    cancelQuestionMutation.isPending ||
    destroySessionMutation.isPending;

  const activeQuestionStatus = useMemo(() => {
    if (!activeQuestion) {
      return null;
    }

    if (activeQuestion.stage === "awaitingHostDecision") {
      return activeQuestion.answeringPlayer
        ? `Reviewing answer from ${activeQuestion.answeringPlayer.name}`
        : "Waiting for the assigned player to answer";
    }

    if (activeQuestion.stage === "openForBuzz") {
      return "Buzzers are open";
    }

    return null;
  }, [activeQuestion]);

  const canActivateQuestion = Boolean(
    session &&
      !anyMutationPending &&
      !activeQuestion &&
      currentTurn &&
      selectedCategory &&
      selectedDifficulty &&
      availableDifficulties.includes(
        selectedDifficulty as "easy" | "medium" | "hard"
      )
  );

  const canMarkCorrect = Boolean(
    activeQuestion &&
      activeQuestion.stage === "awaitingHostDecision" &&
      activeQuestion.answeringPlayer
  );

  const canOpenBuzzers = Boolean(
    activeQuestion &&
      activeQuestion.stage === "awaitingHostDecision" &&
      !openBuzzersMutation.isPending
  );

  const canCloseIncorrect = Boolean(
    activeQuestion && !markIncorrectMutation.isPending
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 rounded-[28px] bg-slate-950/85 px-6 py-8 shadow-glow backdrop-blur">
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
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Host Console
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Guide the game, queue questions, and confirm answers.
            </p>
          </div>
        </header>

        {(actionError || lastError) && (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {actionError ?? lastError}
          </p>
        )}

        {!session ? (
          <div className="mt-8 grid place-items-center gap-4 rounded-2xl border border-dashed border-slate-500/40 bg-slate-900/60 p-12 text-center">
            <p className="text-lg text-slate-200">Host access required</p>
            <p className="max-w-md text-sm text-slate-400">
              Use the host link you received after creating the game. You can
              start a new session from the home page if needed.
            </p>
            <button
              type="button"
              onClick={handleExit}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-500/40 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
            >
              Return home
            </button>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),340px]">
            <div className="flex flex-col gap-6">
              <HostRoomSummary
                session={session}
                statusClassName={statusStyles[status]}
                statusLabel={status}
                inviteLink={inviteLink}
                boardLink={boardLink}
              />

              <HostTurnControls
                currentTurnLabel={currentTurn?.name ?? "—"}
                statusMessage={activeQuestionStatus}
                onCancelQuestion={() => cancelQuestionMutation.mutate()}
                cancelDisabled={
                  cancelQuestionMutation.isPending || !activeQuestion
                }
                categoryOptions={categoryOptions}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                availableDifficulties={availableDifficulties}
                selectedDifficulty={selectedDifficulty}
                onSelectDifficulty={setSelectedDifficulty}
                onActivate={() => {
                  if (!selectedCategory || !selectedDifficulty) {
                    return;
                  }
                  void activateQuestionMutation.mutateAsync({
                    category: selectedCategory,
                    difficulty: selectedDifficulty as
                      | "easy"
                      | "medium"
                      | "hard",
                  });
                }}
                canActivate={canActivateQuestion}
                onOpenBuzzers={() => openBuzzersMutation.mutate()}
                canOpenBuzzers={canOpenBuzzers}
                onMarkIncorrect={() => markIncorrectMutation.mutate(false)}
                onPassToBuzzers={() => markIncorrectMutation.mutate(true)}
                canMarkIncorrect={canCloseIncorrect}
                onMarkCorrect={() =>
                  markCorrectMutation.mutate(
                    activeQuestion?.answeringPlayer?.playerId
                  )
                }
                canMarkCorrect={canMarkCorrect}
              />

              <HostActiveQuestionCard activeQuestion={activeQuestion} />

              <HostLastResultCard lastResult={lastResult} />

              <HostAvailableSlotsCard
                categoryCount={categoryOptions.length}
                selectedCategoryLabel={
                  categoryOptions.find(
                    (option) => option.value === selectedCategory
                  )?.label ?? "—"
                }
                selectedDifficultyLabel={
                  selectedDifficulty
                    ? formatCategoryLabel(selectedDifficulty)
                    : "—"
                }
              />

              <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-6 py-5 text-sm text-rose-100">
                <header className="flex flex-col gap-1 text-rose-200">
                  <span className="text-xs uppercase tracking-[0.3em]">
                    Danger zone
                  </span>
                  <h2 className="text-xl font-semibold text-rose-100">
                    End this game
                  </h2>
                </header>
                <p className="mt-3 text-rose-100/80">
                  Closing the room disconnects every player and clears the
                  board. This cannot be undone.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDestroyConfirm(true)}
                    disabled={destroySessionMutation.isPending || !session}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:from-rose-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {destroySessionMutation.isPending
                      ? "Ending game..."
                      : "End game for everyone"}
                  </button>
                </div>
              </section>
            </div>

            <HostPlayersList
              players={players}
              currentTurn={currentTurn}
              onMakeTurn={(playerId) => setTurnMutation.mutate(playerId)}
              disableInteractions={setTurnMutation.isPending}
            />
          </div>
        )}
      </div>

      {showDestroyConfirm && session ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-500/40 bg-slate-950/95 p-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-slate-100">
              End game for everyone?
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              All players will be disconnected and the room will be removed. You
              will need to create a new room to play again.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDestroyConfirm(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-500/40 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
              >
                Keep room open
              </button>
              <button
                type="button"
                onClick={() =>
                  session && destroySessionMutation.mutate(session)
                }
                disabled={destroySessionMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:from-rose-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {destroySessionMutation.isPending
                  ? "Ending..."
                  : "Yes, end game"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
