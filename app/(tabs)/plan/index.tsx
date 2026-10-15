import { LinkHub } from "../../../src/lib/link-hub";
import { PLAN_LINKS } from "../../../src/lib/plan-links";

export default function PlanTab() {
  return <LinkHub title="Plan" links={PLAN_LINKS} />;
}
