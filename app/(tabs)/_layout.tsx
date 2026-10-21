import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { BottomNav, Button, NAV, NavRail, Sidebar, Toast, useKeyboard, useTheme, type Destination } from "@/design";
import { AUTH_ROUTES } from "@/features/auth-onboarding";
import {
  DashboardOverlayHost,
  DashboardOverlayProvider,
  useDashboardOverlays,
} from "@/features/dashboard";
import { AddTransactionSheet } from "@/features/transactions";
import { activeFromPath, isTabRoot, navMode, phoneBarDestinations, showPhoneBar } from "@/lib";
import { isWarmed } from "@/lib/session-warmup";
import { UserScope, useSession } from "@/state";
import { useOutboxSync } from "@/sync/use-outbox-sync";

const HREFS: Record<Destination, "/(tabs)" | "/(tabs)/transactions" | "/(tabs)/budget" | "/(tabs)/plan" | "/(tabs)/accounts" | "/(tabs)/more"> = {
  home: "/(tabs)",
  transactions: "/(tabs)/transactions",
  budget: "/(tabs)/budget",
  plan: "/(tabs)/plan",
  accounts: "/(tabs)/accounts",
  more: "/(tabs)/more",
};

export default function TabsLayout() {
  const { status } = useSession();
  if (status === "loading") return null;
  if (status !== "signedIn") return <Redirect href="/(auth)" />;
  if (!isWarmed()) return <Redirect href={AUTH_ROUTES.splash} />;
  return (
    <UserScope>
      <DashboardOverlayProvider>
        <TabsLayoutInner />
      </DashboardOverlayProvider>
    </UserScope>
  );
}

function TabsLayoutInner() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTheme();
  const mode = navMode(t.widthClass, t.portrait);
  const active = activeFromPath(pathname);
  const { workspaces } = useSession();
  const { navHidden } = useDashboardOverlays();
  // The phone bar would ride up on top of the keyboard; hide it while typing.
  const keyboard = useKeyboard();
  useOutboxSync();
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<"expense" | "income" | undefined>();
  const [addSession, setAddSession] = useState(0);
  const [addDate, setAddDate] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const phoneIds = new Set<string>(phoneBarDestinations());
  const go = (id: string) => {
    const href = HREFS[id as Destination] ?? HREFS.home;
    if (id === active && isTabRoot(pathname, id as Destination)) return;
    router.replace(href);
  };
  const openSheet = (kind: "expense" | "income", date?: string) => {
    setAddKind(kind);
    setAddDate(date);
    setAddSession((session) => session + 1);
    setAddOpen(true);
  };

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.c.bg },
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
      tabBar={() =>
        mode === "bottom" && !addOpen && !navHidden && !keyboard.open && showPhoneBar(pathname) ? (
          <BottomNav key={t.scheme} active={active} items={NAV.filter(([id]) => phoneIds.has(id))} onNavigate={go} onAdd={() => openSheet("expense")} addLabel="Add money" />
        ) : null
      }
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="budget" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="accounts" />
      <Tabs.Screen name="more" options={{ href: null }} />
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
            workspace={workspaces[0]?.name ?? "Personal"}
            footer={
              <Button fullWidth icon="plus" onPress={() => openSheet("expense")}>
                Add money
              </Button>
            }
          />
        ) : (
          <NavRail active={active} onNavigate={go} fab={{ label: "Add money", onPress: () => openSheet("expense") }} />
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
        onExpense={(date) => openSheet("expense", date)}
        onIncome={(date) => openSheet("income", date)}
        onTransfer={() => router.push("/(tabs)/accounts/transfer")}
        onComingLater={(message) => setToast(message)}
      />
      <AddTransactionSheet
        key={addSession}
        open={addOpen}
        initialKind={addKind}
        initialDate={addDate}
        onClose={() => setAddOpen(false)}
        onSaved={(message) => {
          setAddOpen(false);
          setToast(message);
        }}
      />
    </View>
  );
}
