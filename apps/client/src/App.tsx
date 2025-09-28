import { useQueryClient } from "@tanstack/react-query";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { HostView } from "./components/HostView";
import { JoinForm } from "./components/JoinForm";
import { PlayerConsole } from "./components/PlayerConsole";
import { QuestionLibrary } from "./components/QuestionLibrary";
import { HostSecretError } from "./components/HostSecretError";
import { usePlayerSession } from "./hooks/usePlayerSession";
import { savePlayerSession } from "./utils/playerSessionStorage";
import { HomePage } from "./pages";

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
        <h1 className="text-center text-3xl font-semibold text-slate-100">
          Join room {code}
        </h1>
        <p className="text-center text-sm text-slate-300">
          Enter your name to join the game. The host shared this code with you.
        </p>
        <JoinForm
          code={code}
          onJoin={(playerSession) => {
            savePlayerSession(playerSession);
            queryClient.setQueryData(
              [
                "player-session",
                playerSession.code.toUpperCase(),
                playerSession.playerId,
              ],
              playerSession
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
        navigate("/", { replace: true });
      }}
    />
  );
}

function CodeRoute() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const hasHostSecretParam = searchParams.has("hostSecret");
  const hostSecret = searchParams.get("hostSecret");

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
      <Route path="/" element={<HomePage />} />
      <Route path="/:code/questions" element={<QuestionLibrary />} />
      <Route path="/:code/:playerId" element={<PlayerRoute />} />
      <Route path="/:code" element={<CodeRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
