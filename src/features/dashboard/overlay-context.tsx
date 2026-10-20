import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Overlay = "none" | "quick-add" | "search";
type AddKind = "expense" | "income";
/** An add-sheet request; `date` (YYYY-MM-DD) prefills the entry date, for backfilling a past day. */
type AddRequest = { kind: AddKind; date?: string };

interface DashboardOverlayApi {
  overlay: Overlay;
  openQuickAdd: () => void;
  openSearch: () => void;
  close: () => void;
  /** An add sheet a screen asked for directly (Home's Expense and Income buttons), skipping the chooser. */
  requested: AddRequest | null;
  requestAdd: (kind: AddKind, date?: string) => void;
  clearRequest: () => void;
  /** A screen in a mode with its own bottom bar (Transactions select mode) hides the tab bar while it lasts. */
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
}

const DashboardOverlayContext = createContext<DashboardOverlayApi | null>(null);

export function DashboardOverlayProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [requested, setRequested] = useState<AddRequest | null>(null);
  const [navHidden, setNavHidden] = useState(false);
  const value = useMemo<DashboardOverlayApi>(
    () => ({
      overlay,
      openQuickAdd: () => setOverlay("quick-add"),
      openSearch: () => setOverlay("search"),
      close: () => setOverlay("none"),
      requested,
      requestAdd: (kind, date) => setRequested({ kind, date }),
      clearRequest: () => setRequested(null),
      navHidden,
      setNavHidden,
    }),
    [overlay, requested, navHidden],
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
      requested: null,
      requestAdd: () => undefined,
      clearRequest: () => undefined,
      navHidden: false,
      setNavHidden: () => undefined,
    }
  );
}
