import { useRouter } from "expo-router";
import { HomeScreen } from "../../src/features/dashboard";

export default function HomeRoute() {
  const router = useRouter();
  return <HomeScreen onMore={() => router.push("/(tabs)/more")} />;
}
