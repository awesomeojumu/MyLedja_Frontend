import { useRouter } from "expo-router";
import { afterTerms, TermsPrivacyScreen } from "../../src/features/auth-onboarding";

export default function TermsRoute() {
  const router = useRouter();
  return <TermsPrivacyScreen onBack={() => router.back()} onSubmit={() => router.push(afterTerms())} />;
}
