import { useEffect } from "react";
import { GlobalSearchOverlay } from "@/features/dashboard/components/GlobalSearchOverlay";
import { QuickAddOverlay } from "@/features/dashboard/components/QuickAddOverlay";
import { useDashboardOverlays } from "@/features/dashboard/overlay-context";

export function DashboardOverlayHost({
  onExpense,
  onIncome,
  onTransfer,
  onComingLater,
}: {
  onExpense: (date?: string) => void;
  onIncome: (date?: string) => void;
  onTransfer: () => void;
  onComingLater: (message: string) => void;
}) {
  const { overlay, close, requested, clearRequest } = useDashboardOverlays();
  useEffect(() => {
    if (!requested) return;
    clearRequest();
    if (requested.kind === "income") onIncome(requested.date);
    else onExpense(requested.date);
  }, [requested, clearRequest, onExpense, onIncome]);
  return (
    <>
      <QuickAddOverlay
        open={overlay === "quick-add"}
        onClose={close}
        onPick={(id) => {
          close();
          if (id === "expense") {
            onExpense();
            return;
          }
          if (id === "income") {
            onIncome();
            return;
          }
          if (id === "transfer") {
            onTransfer();
            return;
          }
          onComingLater("Coming in that feature");
        }}
      />
      <GlobalSearchOverlay open={overlay === "search"} onClose={close} />
    </>
  );
}
