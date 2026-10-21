import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, maxWidth, Rise, Txt, useTheme } from "@/design";
import {
  AccountGroupSection,
  AccountPanel,
  AccountsActions,
  AccountsEmpty,
  AccountsHeader,
  AccountsSearchCard,
  AttentionBanner,
  PanelHint,
  type QuickAction,
} from "@/features/accounts/components/AccountsParts";
import { rememberAccountOptions } from "@/features/accounts/services/account-options";
import {
  groupAccounts,
  issues as findIssues,
  primaryAccount,
  toViews,
  totals as sumTotals,
  type AccountSort,
  type GroupMode,
} from "@/features/accounts/services/accounts-view";
import { LiveNotice } from "@/lib/live-notice";
import { nairaAmount, rowKind, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { readCache, scopedKey, writeCache } from "@/lib/offline-cache";
import { DefaultLoading } from "@/lib/screen-state";
import type { LedgerItem } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { useScrollTopOnFocus } from "@/lib/ui";

const EMPTY = { accounts: [] as ApiAccount[], archived: 0, txns: [] as ApiTransaction[] };
/** More than this and the header slims down and search, grouping and sort appear. */
const MANY = 10;

function useSavedSet(name: string): [Set<string>, (id: string) => void] {
  const { user, workspaces } = useSession();
  const key = user && workspaces[0] ? scopedKey(user.userId, workspaces[0].id, name) : null;
  const [ids, setIds] = useState<Set<string>>(() => new Set(key ? readCache<string[]>(key) ?? [] : []));
  const toggle = (id: string) =>
    setIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (key) writeCache(key, [...next]);
      return next;
    });
  return [ids, toggle];
}

export function AccountsScreen({ empty: _empty = false }: { empty?: boolean } = {}) {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user } = useSession();
  const [pinned, togglePin] = useSavedSet("accounts-pinned");
  const [collapsed, toggleCollapsed] = useSavedSet("accounts-collapsed");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<GroupMode>("type");
  const [sort, setSort] = useState<AccountSort>("balance");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wide = (t.widthClass === "expanded" || t.widthClass === "large") && !t.portrait;

  const load = useCallback(
    async (workspaceId: string) => {
      const [res, archivedRes, txRes] = await Promise.all([
        session.listAccounts(workspaceId),
        session.listAccounts(workspaceId, true).catch(() => ({ data: [] as unknown[] })),
        session.listTransactions(workspaceId).catch(() => ({ data: { transactions: [] as ApiTransaction[] } })),
      ]);
      const rows = Array.isArray(res.data) ? res.data : [];
      if (user) rememberAccountOptions(user.userId, workspaceId, rows);
      return {
        accounts: rows as ApiAccount[],
        archived: Array.isArray(archivedRes.data) ? archivedRes.data.length : 0,
        txns: (txRes.data?.transactions ?? []).filter((row) => row.id),
      };
    },
    [session, user],
  );
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, EMPTY, "accounts-view");

  const txns = data?.txns ?? [];
  const views = toViews(data?.accounts ?? [], txns, pinned);
  const many = views.length > MANY;
  const totals = known && views.length > 0 ? sumTotals(views) : null;
  const groups = groupAccounts(views, many ? mode : "type", many ? sort : "balance", many ? query : "");
  const problems = findIssues(views);
  const primary = primaryAccount(views);
  const add = () => router.push("/(tabs)/accounts/types");
  const withId = (path: string, id?: string) => router.push(id ? `/(tabs)/accounts/${path}?id=${encodeURIComponent(id)}` : `/(tabs)/accounts/${path}`);

  const actions: QuickAction[] = [
    { label: "Transfer", icon: "arrow-left-right", onPress: () => router.push("/(tabs)/accounts/transfer") },
    { label: "Link bank", icon: "link", onPress: () => router.push("/(tabs)/accounts/institution") },
    { label: "Import", icon: "file-up", onPress: () => withId("import", primary?.id) },
    { label: "Reconcile", icon: "scale", onPress: () => withId("reconcile", primary?.id) },
  ];

  const open = (id: string) => (wide ? setSelectedId((cur) => (cur === id ? null : id)) : router.push(`/(tabs)/accounts/${id}`));

  const archivedLink = (
    <Pressable
      onPress={() => router.push("/(tabs)/accounts/archived")}
      accessibilityRole="link"
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: t.space.space3 }}
    >
      <Icon name="archive" size={14} color={t.c.primary} />
      <Txt variant="caption" color={t.c.primary} style={{ fontWeight: "600" }}>
        {data && data.archived > 0 ? `${data.archived} archived ${data.archived === 1 ? "account" : "accounts"}` : "Archived accounts"}
      </Txt>
    </Pressable>
  );

  const groupList = (
    <View style={{ gap: t.space.space4 }}>
      {groups.length === 0 && query ? (
        <Txt variant="body" color={t.c.inkMuted} style={{ textAlign: "center", paddingVertical: t.space.space6 }}>{`No account matches "${query.trim()}"`}</Txt>
      ) : null}
      {groups.map((g) => (
        <AccountGroupSection
          key={g.key}
          group={g}
          collapsed={!wide && !query && collapsed.has(g.key)}
          onToggle={() => toggleCollapsed(g.key)}
          showAll={wide || !!query || expanded.has(g.key)}
          onShowAll={() => setExpanded((cur) => new Set(cur).add(g.key))}
          compact={many}
          selectedId={wide ? selectedId : undefined}
          onOpen={open}
          onPin={togglePin}
        />
      ))}
      {archivedLink}
    </View>
  );

  const body =
    loading && !known ? (
      <DefaultLoading />
    ) : known && views.length === 0 ? (
      <AccountsEmpty onAdd={add} />
    ) : (
      <View style={{ gap: t.space.space4 }}>
        <AttentionBanner issues={problems} onFix={(id) => withId("reconcile", id)} />
        <Rise delay={40}>{groupList}</Rise>
      </View>
    );

  const header = (
    <AccountsHeader
      topInset={insets.top}
      count={views.length}
      many={many}
      totals={totals}
      wide={wide}
      actions={actions}
      onArchived={() => router.push("/(tabs)/accounts/archived")}
      onAdd={add}
      addLabel="Add account"
    />
  );
  const notice = <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />;

  if (wide) {
    const selected = views.find((v) => v.id === selectedId) ?? null;
    const activity: LedgerItem[] = selected
      ? txns
          .filter((row) => String(row.accountId) === selected.id || String(row.toAccountId ?? "") === selected.id)
          .sort((a, b) => Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""))
          .slice(0, 5)
          .map((row) => ({
            id: String(row.id),
            title: row.description || "Transaction",
            account: "",
            amount: nairaAmount(row.amount),
            kind: rowKind(row.type),
            time: row.occurredAt ? new Date(row.occurredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
            pending: row.status === "pending",
          }))
      : [];
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 }}>
          {header}
          <View style={{ width: "100%", maxWidth: maxWidth.widthContent, alignSelf: "center", padding: t.space.space6, gap: t.space.space4 }}>
            {notice}
            {many ? (
              <View style={{ maxWidth: 520 }}>
                <AccountsSearchCard overlap={false} query={query} onQuery={setQuery} mode={mode} onMode={setMode} sort={sort} onSort={setSort} />
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: t.space.space5, alignItems: "flex-start" }}>
              <View style={{ flex: 1, minWidth: 0 }}>{body}</View>
              {views.length > 0 ? (
                <View style={{ width: 320 }}>
                  {selected ? (
                    <AccountPanel
                      view={selected}
                      activity={activity}
                      onClose={() => setSelectedId(null)}
                      onOpen={() => router.push(`/(tabs)/accounts/${selected.id}`)}
                      onTransfer={() => router.push("/(tabs)/accounts/transfer")}
                      onReconcile={() => withId("reconcile", selected.id)}
                      onImport={() => withId("import", selected.id)}
                      onAdjust={() => withId("adjust", selected.id)}
                      onPin={() => togglePin(selected.id)}
                      onOpenTransaction={(id) => router.push(`/(tabs)/transactions/${id}`)}
                    />
                  ) : (
                    <PanelHint>Select an account to see its activity and actions here.</PanelHint>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 + t.space.space8 }} keyboardShouldPersistTaps="handled">
        {header}
        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center" }}>
          {views.length === 0 ? (
            <View style={{ height: 40 }} />
          ) : many ? (
            <AccountsSearchCard query={query} onQuery={setQuery} mode={mode} onMode={setMode} sort={sort} onSort={setSort} />
          ) : (
            <AccountsActions actions={actions} />
          )}
          <View style={{ paddingHorizontal: t.space.space3, paddingTop: t.space.space4, gap: t.space.space4 }}>
            {notice}
            {body}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
