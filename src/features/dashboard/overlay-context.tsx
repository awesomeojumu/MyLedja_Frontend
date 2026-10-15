import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Overlay = "none" | "quick-add" | "search";

interface DashboardOverlayApi {
  overlay: Overlay;
  openQuickAdd: () => void;
  openSearch: () => void;
  close: () => void;
}

const DashboardOverlayContext = createContext<DashboardOverlayApi | null>(null);

export function DashboardOverlayProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>("none");
  const value = useMemo<DashboardOverlayApi>(
    () => ({
      overlay,
      openQuickAdd: () => setOverlay("quick-add"),
      openSearch: () => setOverlay("search"),
      close: () => setOverlay("none"),
    }),
    [overlay],
  );
  return <DashboardOverlayContext.Provider value={value}>{children}</DashboardOverlayContext.Provider>;
}

export function useDashboardOverlays(): DashboardOverlayApi {
  return (
    useContext(DashboardOverlayContext) ?? {
      overlay: "none",
      openQuickAdd: () => undefined,
      openSearch: () => undefined,
      close: () => undefined,
    }
  );
}
