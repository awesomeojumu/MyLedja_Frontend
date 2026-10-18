import { useEffect } from "react";
import { afterMoneyWrite } from "@/lib/after-money";
import { syncOutbox } from "@/sync/save-transaction";
import { outboxForUser } from "@/sync/user-outbox";
import { useSession } from "@/state";

const RETRY_MS = 20_000;

/** Retries queued records while signed in: at start, when the browser reports it is back online, and every 20 s. */
export function useOutboxSync(): void {
  const { session, user, status } = useSession();
  const userId = user?.userId;

  useEffect(() => {
    if (status !== "signedIn" || !userId) return;
    const run = () => {
      void syncOutbox(outboxForUser(userId), userId, (workspaceId, payload, operationId) =>
        session.createTransaction(workspaceId, { ...(payload as object), operationId }),
      ).then((sent) => {
        if (sent > 0) afterMoneyWrite();
      });
    };
    run();
    const timer = setInterval(run, RETRY_MS);
    const online = () => run();
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("online", online);
    }
    return () => {
      clearInterval(timer);
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("online", online);
      }
    };
  }, [session, status, userId]);
}
