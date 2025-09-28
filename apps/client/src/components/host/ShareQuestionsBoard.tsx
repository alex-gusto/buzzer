import { useMutation } from "@tanstack/react-query";
import { shareRoom } from "../../api";
import { useEffect, useMemo, useState } from "react";
import { HostSession } from "./types";
import { useSessionConnection } from "../../hooks/useSessionConnection";

type Props = {
  session: HostSession;
};

export function SharedQuestionsBoard({ session }: Props) {
  const [shareDetails, setShareDetails] = useState<{
    shareCode: string;
    expiresAt: number | null;
  } | null>(null);

  const registerPayload = useMemo(
    () =>
      session
        ? ({
            type: "register",
            role: "host",
            hostSecret: session.hostSecret,
          } as const)
        : undefined,
    [session]
  );

  const { state } = useSessionConnection({
    code: session?.code ?? null,
    registerPayload,
  });

  useEffect(() => {
    if (state?.shareCode) {
      setShareDetails({
        shareCode: state.shareCode,
        expiresAt: state.shareCodeExpiresAt ?? null,
      });
    } else {
      setShareDetails(null);
    }
  }, [state?.shareCode, state?.shareCodeExpiresAt]);

  const shareRoomMutation = useMutation<
    { shareCode: string; expiresAt: number | null },
    Error,
    HostSession
  >({
    mutationFn: async (payload) => shareRoom(payload.code, payload.hostSecret),
    onSuccess: (result) => {
      setShareDetails({
        shareCode: result.shareCode,
        expiresAt: result.expiresAt,
      });
    },
    onError: (error) => {
      console.log("🚀 ~ SharedQuestionsBoard ~ error:", error);
    },
  });

  const activeShareCode = shareDetails?.shareCode ?? null;
  console.log("🚀 ~ SharedQuestionsBoard ~ activeShareCode:", activeShareCode)
  const shareExpiresAt = shareDetails?.expiresAt ?? null;
  const shareExpiresInMs = shareExpiresAt ? shareExpiresAt - Date.now() : null;
  const shareExpiresLabel =
    shareExpiresInMs && shareExpiresInMs > 0
      ? `${Math.ceil(shareExpiresInMs / 60000)} min`
      : null;

  return (
    <div className="flex items-center gap-4">
      {!activeShareCode && (
        <button
          type="button"
          onClick={() => session && shareRoomMutation.mutate(session)}
          disabled={shareRoomMutation.isPending || !session}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {shareRoomMutation.isPending
            ? "Generating..."
            : "Generate share code"}
        </button>
      )}

      {activeShareCode && (
        <div className="flex items-baseline gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm">
          <span className="font-semibold tracking-[0.4em] text-cyan-100">
            {activeShareCode}
          </span>
          {shareExpiresLabel ? (
            <span className="text-xs text-cyan-100/80">
              expires in {shareExpiresLabel}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
