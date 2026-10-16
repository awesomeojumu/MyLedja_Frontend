import { Banner } from "../../../design";
import { WidePane } from "../../../lib";
import { CatScreen } from "../components/CatScreen";
import { MerchantList } from "../components/MerchantList";
import { MERCHANTS } from "../dummy-data";

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
