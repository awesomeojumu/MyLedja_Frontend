import { CatScreen } from "@/features/categories-merchants/components/CatScreen";
import { MerchantList } from "@/features/categories-merchants/components/MerchantList";

export function MerchantsScreen() {
  return (
    <CatScreen title="Merchants" showBack emptyTitle="No merchants yet">
      <MerchantList />
    </CatScreen>
  );
}
