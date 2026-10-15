import { useRouter } from "expo-router";
import { afterSplash, SplashScreen } from "../../src/features/auth-onboarding";

export default function SplashRoute() {
  const router = useRouter();
  return <SplashScreen onDone={() => router.replace(afterSplash())} />;
}
