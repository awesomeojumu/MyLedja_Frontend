import { AccountCard } from "../../../src/features/settings-privacy";
import { LinkHub } from "../../../src/lib/link-hub";
import { MORE_LINKS } from "../../../src/lib/plan-links";
import { useSession, useSignOut } from "../../../src/state";

export default function MoreTab() {
  const { user } = useSession();
  const signOut = useSignOut();
  return (
    <LinkHub
      title="More"
      links={MORE_LINKS}
      footer={<AccountCard email={user?.email ?? null} onSignOut={signOut} />}
    />
  );
}
