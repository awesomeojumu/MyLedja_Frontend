import { LinkHub } from "@/lib/link-hub";
import { PLAN_LINKS } from "@/lib/plan-links";

export default function PlanTab() {
  return <LinkHub title="Plan" links={PLAN_LINKS} />;
}
