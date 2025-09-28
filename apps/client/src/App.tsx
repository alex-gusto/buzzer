import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
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
import { HostSecretError } from './components/HostSecretError';
import { createSession } from './api';
import { usePlayerSession } from './hooks/usePlayerSession';
import {
  clearPlayerSession,
  savePlayerSession,
} from './utils/playerSessionStorage';

function Landing() {
  const navigate = useNavigate();
  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      navigate(`/${session.code}?hostSecret=${session.hostSecret}`);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900/80 via-slate-900/95 to-slate-950 pb-16 pt-24 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 rounded-[32px] bg-slate-950/85 px-8 py-14 shadow-glow backdrop-blur">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">Buzzer Party</h1>
          <p className="mt-4 text-lg text-slate-300">
            Spin up a trivia room, share the invite link, and see who buzzes in first.
          </p>
        </header>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <button
            type="button"
            onClick={() => createSessionMutation.mutate()}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-6 py-4 text-lg font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createSessionMutation.isPending}
          >
            {createSessionMutation.isPending ? 'Creating…' : 'Create a game'}
          </button>
          {createSessionMutation.isError ? (
            <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
              Something went wrong. Try again.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function JoinRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const code = params.code?.toUpperCase();

  if (!code) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-[32px] bg-slate-950/90 px-6 py-8 shadow-glow backdrop-blur">
        <h1 className="text-center text-3xl font-semibold text-slate-100">Join room {code}</h1>
        <p className="text-center text-sm text-slate-300">
          Enter your name to join the game. The host shared this code with you.
        </p>
        <JoinForm
          code={code}
          onJoin={(playerSession) => {
            savePlayerSession(playerSession);
            queryClient.setQueryData(
              ['player-session', playerSession.code.toUpperCase(), playerSession.playerId],
              playerSession,
            );
            navigate(`/${playerSession.code}/${playerSession.playerId}`);
          }}
        />
      </div>
    </div>
  );
}

function PlayerRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const code = params.code?.toUpperCase();
  const playerId = params.playerId ?? null;
  const { data: session, isPending } = usePlayerSession(code ?? null, playerId);

  if (!code || !playerId) {
    return <Navigate to="/" replace />;
  }

  if (!session && !isPending) {
    return <Navigate to={`/${code}`} replace />;
  }

  if (!session) {
    return null;
  }

  return (
    <PlayerConsole
      session={session}
      onExit={() => {
        clearPlayerSession(code, session.playerId);
        queryClient.removeQueries({ queryKey: ['player-session', code, session.playerId], exact: true });
        navigate(`/${code}`);
      }}
    />
  );
}

function CodeRoute() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const hasHostSecretParam = searchParams.has('hostSecret');
  const hostSecret = searchParams.get('hostSecret');

  if (!params.code) {
    return <Navigate to="/" replace />;
  }

  if (hasHostSecretParam && (!hostSecret || hostSecret.trim().length === 0)) {
    return <HostSecretError />;
  }

  if (hostSecret) {
    return <HostView />;
  }

  return <JoinRoute />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/:code/questions" element={<QuestionLibrary />} />
      <Route path="/:code/:playerId" element={<PlayerRoute />} />
      <Route path="/:code" element={<CodeRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
