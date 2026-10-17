import { useRouter } from "expo-router";
import { useCallback } from "react";
import { AUTH_ROUTES, forgetSignup } from "@/features/auth-onboarding";
import { resetWarmup } from "@/lib/session-warmup";
import { useSession } from "@/state/session";

/** Revokes the session on the server, wipes local user state and returns to Welcome. */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const { session } = useSession();
  return useCallback(async () => {
    await session.signOut();
    resetWarmup();
    forgetSignup();
    router.replace(AUTH_ROUTES.welcome);
  }, [router, session]);
}
