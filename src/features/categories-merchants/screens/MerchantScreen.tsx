import { CatScreen } from "@/features/categories-merchants/components/CatScreen";
import { MerchantList } from "@/features/categories-merchants/components/MerchantList";

export function MerchantScreen() {
  return (
    <CatScreen title="Merchant" showBack>
      <MerchantList />
    </CatScreen>
  );
}
