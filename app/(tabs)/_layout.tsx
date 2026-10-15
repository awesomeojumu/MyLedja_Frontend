import { Tabs, usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { BottomNav, Button, NAV, NavRail, Sidebar, Toast, useTheme, type Destination } from "../../src/design";
import {
  DashboardOverlayHost,
  DashboardOverlayProvider,
  useDashboardOverlays,
} from "../../src/features/dashboard";
import { AddTransactionSheet } from "../../src/features/transactions";
import { activeFromPath, navMode, phoneBarDestinations } from "../../src/lib";

const HREFS: Record<Destination, "/(tabs)" | "/(tabs)/transactions" | "/(tabs)/plan" | "/(tabs)/accounts" | "/(tabs)/more"> = {
  home: "/(tabs)",
  transactions: "/(tabs)/transactions",
  plan: "/(tabs)/plan",
  accounts: "/(tabs)/accounts",
  more: "/(tabs)/more",
};

export default function TabsLayout() {
  return (
    <DashboardOverlayProvider>
      <TabsLayoutInner />
    </DashboardOverlayProvider>
  );
}

function TabsLayoutInner() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTheme();
  const mode = navMode(t.widthClass, t.portrait);
  const active = activeFromPath(pathname);
  const { openQuickAdd } = useDashboardOverlays();
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<"expense" | "income" | undefined>();
  const [addSession, setAddSession] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const phoneIds = new Set<string>(phoneBarDestinations());
  const go = (id: string) => {
    const href = HREFS[id as Destination] ?? HREFS.home;
    router.replace(href);
  };
  const openSheet = (kind: "expense" | "income") => {
    setAddKind(kind);
    setAddSession((session) => session + 1);
    setAddOpen(true);
  };

  const tabs = (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={() =>
        mode === "bottom" && !addOpen ? (
          <BottomNav active={active} items={NAV.filter(([id]) => phoneIds.has(id))} onNavigate={go} onAdd={openQuickAdd} />
        ) : null
      }
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="accounts" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="cash-flow" options={{ href: null }} />
      <Tabs.Screen name="net-worth" options={{ href: null }} />
      <Tabs.Screen name="upcoming" options={{ href: null }} />
      <Tabs.Screen name="goals-preview" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
    </Tabs>
  );

  const shell =
    mode === "bottom" ? (
      tabs
    ) : (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.c.bg }}>
        {mode === "side" ? (
          <Sidebar
            active={active}
            onNavigate={go}
            workspace="Personal"
            footer={
              <Button fullWidth icon="plus" onPress={openQuickAdd}>
                Add transaction
              </Button>
            }
          />
        ) : (
          <NavRail active={active} onNavigate={go} fab={{ label: "Add transaction", onPress: openQuickAdd }} />
        )}
        <View style={{ flex: 1 }}>{tabs}</View>
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
      {shell}
      {toast ? (
        <View style={{ position: "absolute", left: t.space.space4, right: mode === "side" ? undefined : t.space.space4, bottom: mode === "bottom" ? 108 : t.space.space6, maxWidth: 420 }}>
          <Toast message={toast} action={{ label: "Undo", onPress: () => setToast(null) }} onClose={() => setToast(null)} />
        </View>
      ) : null}
      <DashboardOverlayHost
        onExpense={() => openSheet("expense")}
        onIncome={() => openSheet("income")}
        onComingLater={(message) => setToast(message)}
      />
      <AddTransactionSheet
        key={addSession}
        open={addOpen}
        initialKind={addKind}
        onClose={() => setAddOpen(false)}
        onSaved={(message) => {
          setAddOpen(false);
          setToast(message);
        }}
      />
    </View>
  );
}
