import { useRouter } from "expo-router";
import { DesignCatalog } from "../src/catalog/DesignCatalog";
import { useScheme } from "../src/state";

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
