import type { SocketStatus } from "../../types";
import { CopyButton } from "./CopyButton";
import { SharedQuestionsBoard } from "./ShareQuestionsBoard";
import { HostSession } from "./types";

export type HostRoomSummaryProps = {
  statusClassName: string;
  statusLabel: SocketStatus;
  inviteLink: string;
  boardLink: string;
  session: HostSession;
};

export function HostRoomSummary({
  statusClassName,
  statusLabel,
  inviteLink,
  session,
}: HostRoomSummaryProps) {
  return (
    <section className="rounded-2xl bg-slate-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Room code
            </span>
            <p className="mt-2 text-4xl font-semibold tracking-[0.35em] text-slate-100 md:text-5xl">
              {session.code}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-end">
            <CopyButton
              text={inviteLink}
              idleLabel="Copy invite"
              copiedLabel="Invite copied"
            />
            <SharedQuestionsBoard session={session} />
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium ${statusClassName}`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          {statusLabel}
        </span>
      </div>
    </section>
  );
}
