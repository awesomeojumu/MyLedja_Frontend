import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/categories-merchants";

export default function CategoriesRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}
