import { useRouter } from "expo-router";
import { afterPasskey, PasskeyScreen } from "@/features/auth-onboarding";

export default function PasskeyRoute() {
  const router = useRouter();
  return <PasskeyScreen onContinue={() => router.push(afterPasskey())} />;
}
