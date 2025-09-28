import type { QuestionResultSnapshot } from '../../types';

export function HostLastResultCard({ lastResult }: { lastResult: QuestionResultSnapshot | null }) {
  if (!lastResult) {
    return null;
  }

  return (
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
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Correct answer: {lastResult.correctAnswer}</p>
      </div>
    </section>
  );
}
