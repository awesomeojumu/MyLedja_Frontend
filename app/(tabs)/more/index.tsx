import { AccountCard } from "@/features/settings-privacy";
import { LinkHub } from "@/lib/link-hub";
import { MORE_LINKS } from "@/lib/plan-links";
import { useSession, useSignOut } from "@/state";

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
