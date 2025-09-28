export function HostAvailableSlotsCard({
  categoryCount,
  selectedCategoryLabel,
  selectedDifficultyLabel,
}: {
  categoryCount: number;
  selectedCategoryLabel: string;
  selectedDifficultyLabel: string;
}) {
  return (
    <section className="rounded-2xl bg-slate-900/70 p-6">
      <h3 className="text-xl font-semibold text-slate-100">Available slots</h3>
      <p className="mt-2 text-sm text-slate-300">
        Each category and difficulty combo can be used once per game. Already-played slots are hidden from the pickers above.
      </p>
      <div className="mt-4 grid gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
        <span>Remaining categories: {categoryCount}</span>
        <span>
          Selected: {selectedCategoryLabel} • {selectedDifficultyLabel}
        </span>
      </div>
    </section>
  );
}
