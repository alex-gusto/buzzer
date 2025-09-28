import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { createSession, listRooms, type RoomOverview } from './api';
import { getHostSecret } from './utils/hostSessionStorage';
import { usePlayerSession } from './hooks/usePlayerSession';
import { savePlayerSession } from './utils/playerSessionStorage';

function Landing() {
  const navigate = useNavigate();
  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      navigate(`/${session.code}?hostSecret=${session.hostSecret}`);
    },
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: listRooms,
    refetchInterval: 5000,
    staleTime: 5000,
  });

  const rooms: RoomOverview[] = roomsQuery.data ?? [];

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
            {createSessionMutation.isPending ? 'Creating...' : 'Create a game'}
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
            <h2 className="text-2xl font-semibold tracking-tight">Available rooms</h2>
            <p className="mt-1 text-sm text-slate-400">
              Pick a room below to join instantly or create a new one above.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-100 transition hover:border-slate-300/60 hover:bg-slate-800/60"
            onClick={() => roomsQuery.refetch()}
            disabled={roomsQuery.isFetching}
          >
            {roomsQuery.isFetching ? 'Refreshing...' : 'Refresh' }
          </button>
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
              No open rooms at the moment. Create one above to get started and invite players.
            </p>
          ) : (
            <ul className="divide-y divide-slate-500/20">
              {rooms.map((room) => (
                <li key={room.code} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Room code</span>
                    <span className="text-3xl font-semibold tracking-[0.3em] text-slate-100">{room.code}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300">
                    <span>{room.playerCount} {room.playerCount === 1 ? 'player' : 'players'}</span>
                    <span className={room.hostOnline ? 'text-emerald-200' : 'text-slate-500'}>
                      {room.hostOnline ? 'Host online' : 'Host offline'}
                    </span>
                    <span className={room.questionActive ? 'text-amber-200' : 'text-slate-500'}>
                      {room.questionActive ? 'Question in progress' : 'Waiting for next question'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const hostSecret = getHostSecret(room.code);
                      if (!hostSecret) {
                        return null;
                      }

                      return (
                        <a
                          href={`/${room.code}/questions?hostSecret=${hostSecret}`}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-500/40 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/10"
                        >
                          Open board
                        </a>
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
    return <Navigate to="/" replace />;
  }

  if (!session) {
    return null;
  }

  return (
    <PlayerConsole
      session={session}
      onExit={() => {
        navigate('/', { replace: true });
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
