import type { PlayerSummary, RoomSnapshot } from '../../types';

type HostPlayersListProps = {
  players: PlayerSummary[];
  currentTurn: RoomSnapshot['currentTurn'];
  onMakeTurn: (playerId: string) => void;
  disableInteractions: boolean;
};

export function HostPlayersList({
  players,
  currentTurn,
  onMakeTurn,
  disableInteractions,
}: HostPlayersListProps) {
  return (
    <section className="rounded-2xl bg-slate-900/70 p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-semibold text-slate-100">Players</h3>
        <span className="text-sm text-slate-400">{players.length} joined</span>
      </div>
      <ul className="mt-4 grid gap-3">
        {players.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-500/40 bg-slate-900/40 px-6 py-4 text-center text-sm text-slate-400">
            Share the code so players can join.
          </li>
        ) : (
          players.map((player) => {
            const isCurrent = currentTurn?.playerId === player.id;
            return (
              <li
                key={player.id}
                className={`flex items-center justify-between rounded-xl px-5 py-4 text-sm text-slate-100 transition ${
                  isCurrent ? 'bg-cyan-500/20 border border-cyan-400/30' : 'bg-slate-800/60'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{player.name}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {isCurrent ? 'Selecting now' : 'Waiting'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-slate-100">{player.score} pts</span>
                  <button
                    type="button"
                    onClick={() => onMakeTurn(player.id)}
                    disabled={disableInteractions || isCurrent}
                    className="inline-flex items-center justify-center rounded-full border border-slate-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Make turn
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
