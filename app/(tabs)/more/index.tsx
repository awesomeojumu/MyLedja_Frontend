import { LinkHub } from "../../../src/lib/link-hub";
import { MORE_LINKS } from "../../../src/lib/plan-links";

export default function MoreTab() {
  return <LinkHub title="More" links={MORE_LINKS} />;
}
