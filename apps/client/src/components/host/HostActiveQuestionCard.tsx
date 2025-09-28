import type { ActiveQuestionSnapshot } from '../../types';

export function HostActiveQuestionCard({ activeQuestion }: { activeQuestion: ActiveQuestionSnapshot | null }) {
  return (
    <section className="rounded-2xl bg-slate-900/70 p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-semibold text-slate-100">Active question</h3>
        {activeQuestion ? (
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {activeQuestion.category} • {activeQuestion.points} pts
          </span>
        ) : null}
      </div>
      {activeQuestion ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-500/30 bg-slate-900/80 px-6 py-5">
          <h4 className="text-lg font-semibold text-slate-100">{activeQuestion.title}</h4>
          <p className="text-sm text-slate-300">{activeQuestion.prompt}</p>
          {activeQuestion.correctAnswer ? (
            <p className="text-sm text-emerald-300">
              Correct answer: <span className="font-semibold text-emerald-200">{activeQuestion.correctAnswer}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
            <span>Assigned to {activeQuestion.assignedTo?.name ?? '—'}</span>
            <span>
              Answering{' '}
              {activeQuestion.answeringPlayer?.name ??
                (activeQuestion.stage === 'openForBuzz' ? 'Waiting for buzz' : '—')}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-500/40 bg-slate-900/40 px-6 py-5 text-sm text-slate-400">
          Select a question when the player is ready.
        </p>
      )}
    </section>
  );
}
