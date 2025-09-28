import { useNavigate } from 'react-router-dom';

type HostSecretErrorProps = {
  fallbackPath?: string;
};

export function HostSecretError({ fallbackPath = '/' }: HostSecretErrorProps) {
  const navigate = useNavigate();
  const buttonLabel = fallbackPath === '/' ? 'Return home' : 'Back to room';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-[32px] bg-slate-950/90 px-6 py-8 text-center shadow-glow backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-100">Host secret required</h1>
        <p className="text-sm text-slate-300">
          Open this view from the host link you received after creating the game. The host secret in that link proves you&apos;re allowed to manage the room.
        </p>
        <button
          type="button"
          onClick={() => navigate(fallbackPath)}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-500/40 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
