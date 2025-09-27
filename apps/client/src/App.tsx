import { useQueryClient } from '@tanstack/react-query';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { HostView } from './components/HostView';
import { JoinForm } from './components/JoinForm';
import { PlayerConsole } from './components/PlayerConsole';
import { QuestionLibrary } from './components/QuestionLibrary';
import { usePlayerSession } from './hooks/usePlayerSession';
import {
  clearPlayerSession,
  savePlayerSession,
} from './utils/playerSessionStorage';

function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const defaultCode = searchParams.get('code') ?? undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900/80 via-slate-900/95 to-slate-950 pb-16 pt-24 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 rounded-[32px] bg-slate-950/85 px-8 py-14 shadow-glow backdrop-blur">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">Buzzer Party</h1>
          <p className="mt-4 text-lg text-slate-300">
            Run a lightning-fast buzzer game for your next trivia night.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Link
            to="/new-game"
            className="group flex flex-col gap-3 rounded-2xl border border-transparent bg-slate-800/70 p-8 text-left transition hover:-translate-y-1 hover:border-slate-500/60 hover:bg-slate-800/90 focus:-translate-y-1 focus:border-slate-500/60 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
          >
            <h2 className="text-2xl font-semibold tracking-tight">Host</h2>
            <p className="text-slate-300">Create a room, manage rounds, and watch who buzzes in first.</p>
            <span className="mt-auto inline-flex items-center gap-2 text-sm text-sky-300">
              Start a new game →
            </span>
          </Link>
          <JoinForm
            initialCode={defaultCode}
            onJoin={(session) => {
              savePlayerSession(session);
              queryClient.setQueryData(['player-session', session.code.toUpperCase()], session);
              navigate(`/${session.code}`);
            }}
          />
          <Link
            to="/questions"
            className="group flex flex-col gap-3 rounded-2xl border border-transparent bg-slate-800/70 p-8 text-left transition hover:-translate-y-1 hover:border-slate-500/60 hover:bg-slate-800/90 focus:-translate-y-1 focus:border-slate-500/60 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
          >
            <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
            <p className="text-slate-300">Explore curated prompts by category and difficulty before the game starts.</p>
            <span className="mt-auto inline-flex items-center gap-2 text-sm text-sky-300">
              Open library →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlayerRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const code = params.code?.toUpperCase();
  const { data: session, isPending } = usePlayerSession(code ?? null);

  if (!code) {
    return <Navigate to="/" replace />;
  }

  if (!session && !isPending) {
    return <Navigate to={`/?code=${code}`} replace />;
  }

  if (!session) {
    return null;
  }

  return (
    <PlayerConsole
      session={session}
      onExit={() => {
        clearPlayerSession(code);
        queryClient.removeQueries({ queryKey: ['player-session', code], exact: true });
        navigate(`/?code=${code}`);
      }}
    />
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/new-game" element={<HostView />} />
      <Route path="/questions" element={<QuestionLibrary />} />
      <Route path="/:code" element={<PlayerRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
