import { useRouter } from "expo-router";
import { DesignCatalog } from "@/catalog/DesignCatalog";
import { useScheme } from "@/state";

export default function CatalogRoute() {
  const router = useRouter();
  const { setScheme } = useScheme();
  return (
    <DesignCatalog
      onBack={() => {
        router.back();
        setScheme(undefined);
      }}
      onScheme={setScheme}
    />
  );
}
