import type { CategoryOption } from "./types";

type HostTurnControlsProps = {
  currentTurnLabel: string;
  statusMessage: string | null;
  onCancelQuestion: () => void;
  cancelDisabled: boolean;
  categoryOptions: CategoryOption[];
  selectedCategory: string;
  onSelectCategory: (value: string) => void;
  availableDifficulties: Array<"easy" | "medium" | "hard">;
  selectedDifficulty: "easy" | "medium" | "hard" | "";
  onSelectDifficulty: (value: "easy" | "medium" | "hard" | "") => void;
  onActivate: () => void;
  canActivate: boolean;
  onOpenBuzzers: () => void;
  canOpenBuzzers: boolean;
  onMarkIncorrect: () => void;
  onPassToBuzzers: () => void;
  canMarkIncorrect: boolean;
  onMarkCorrect: () => void;
  canMarkCorrect: boolean;
};

export function HostTurnControls({
  currentTurnLabel,
  statusMessage,
  onCancelQuestion,
  cancelDisabled,
  categoryOptions,
  selectedCategory,
  onSelectCategory,
  availableDifficulties,
  selectedDifficulty,
  onSelectDifficulty,
  onActivate,
  canActivate,
  onOpenBuzzers,
  canOpenBuzzers,
  onMarkIncorrect,
  onPassToBuzzers,
  canMarkIncorrect,
  onMarkCorrect,
  canMarkCorrect,
}: HostTurnControlsProps) {
  return (
    <section className="grid gap-4 rounded-2xl bg-slate-900/70 p-6">
      <div className="grid md:grid-cols-[minmax(220px,260px),1fr] md:items-start">
        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Current turn
          </span>
          <strong className="text-2xl text-slate-100">
            {currentTurnLabel}
          </strong>
          <p className="text-sm text-slate-300">
            {statusMessage ?? "Waiting for the next question."}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Category
            <select
              value={selectedCategory}
              onChange={(event) => onSelectCategory(event.target.value)}
              className="w-full rounded-xl border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
              disabled={categoryOptions.length === 0}
            >
              {categoryOptions.length === 0 ? (
                <option value="">No categories available</option>
              ) : null}
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
                onSelectDifficulty(
                  event.target
                    .value as HostTurnControlsProps["selectedDifficulty"]
                )
              }
              className="rounded-xl border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/40"
              disabled={availableDifficulties.length === 0}
            >
              {availableDifficulties.length === 0 ? (
                <option value="">No difficulties available</option>
              ) : null}
              {availableDifficulties.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onActivate}
          disabled={!canActivate}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Activate question
        </button>
        <button
          type="button"
          onClick={onOpenBuzzers}
          disabled={!canOpenBuzzers}
          className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Open buzzers
        </button>
        <button
          type="button"
          onClick={onMarkIncorrect}
          disabled={!canMarkIncorrect}
          className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mark incorrect
        </button>
        <button
          type="button"
          onClick={onPassToBuzzers}
          disabled={!canMarkIncorrect}
          className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Pass to buzzers
        </button>
        <button
          type="button"
          onClick={onMarkCorrect}
          disabled={!canMarkCorrect}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mark correct
        </button>
        <button
          type="button"
          onClick={onCancelQuestion}
          disabled={cancelDisabled}
          className="inline-flex items-center justify-center rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel question
        </button>
      </div>
    </section>
  );
}
