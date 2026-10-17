import { Banner } from "@/design";
import { WidePane } from "@/lib";
import { CatScreen } from "@/features/categories-merchants/components/CatScreen";
import { MerchantList } from "@/features/categories-merchants/components/MerchantList";
import { MERCHANTS } from "@/features/categories-merchants/dummy-data";

export function MerchantsScreen() {
  const first = MERCHANTS[0];
  return (
    <CatScreen
      title="Merchants"
      demo
      emptyTitle="No merchants yet"
      emptyBody="Names from your records will group here."
      errorTitle="Could not load merchants"
    >
      <WidePane tablet sidebar={<MerchantList selectedId={first?.id} />}>
        {first ? (
          <Banner tone="primary" title={first.name}>
            {first.category} · {first.count} dummy records.
          </Banner>
        ) : null}
      </WidePane>
    </CatScreen>
  );
}
