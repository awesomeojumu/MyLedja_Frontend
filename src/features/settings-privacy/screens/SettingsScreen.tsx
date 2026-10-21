import { useCallback, useState, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Button, Dialog, Icon, Sheet, TextField, Txt, maxWidth, useTheme, type IconName } from "@/design";
import { ListCard, Toggle } from "@/features/settings-privacy/components/MoreParts";
import type { ApiAccount } from "@/lib/money-map";
import { useActiveWorkspace, useScrollTopOnFocus } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useScheme, useSession, useSignOut } from "@/state";

type Tone = { fg: string; bg: string };

interface Row {
  key: string;
  icon: IconName;
  label: string;
  /** Extra words search should match. */
  keywords?: string;
  value?: string;
  valueTone?: "warning" | "muted";
  control?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}

interface Group {
  title: string;
  tone: Tone;
  rows: Row[];
  danger?: boolean;
}

function SettingRow({ row, tone, last }: { row: Row; tone: Tone; last: boolean }) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, minHeight: 52, paddingHorizontal: t.space.space4, paddingVertical: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.c.border }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}>
        <Icon name={row.icon} size={16} color={tone.fg} />
      </View>
      <Txt variant="body" color={row.danger ? t.c.danger : t.c.ink} style={{ flex: 1 }} numberOfLines={2}>{row.label}</Txt>
      {row.control ?? (
        <>
          {row.value ? (
            <Txt variant="caption" color={row.valueTone === "warning" ? t.c.warning : t.c.inkMuted} numberOfLines={1} style={{ maxWidth: 160, fontWeight: row.valueTone === "warning" ? "600" : "400" }}>
              {row.value}
            </Txt>
          ) : null}
          {row.onPress ? <Icon name="chevron-right" size={16} color={t.c.inkMuted} /> : null}
        </>
      )}
    </View>
  );
  return row.onPress && !row.control ? (
    <Pressable onPress={row.onPress} accessibilityRole="button" accessibilityLabel={row.value ? `${row.label}, ${row.value}` : row.label} android_ripple={{ color: t.c.surfaceAlt }}>
      {body}
    </Pressable>
  ) : (
    <View accessible={!row.control} accessibilityLabel={row.value ? `${row.label}, ${row.value}` : undefined}>{body}</View>
  );
}

/** Everything adjustable, grouped, with the current value on the right. Only settings that really work are listed. */
export function SettingsScreen() {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user, workspaces } = useSession();
  const signOut = useSignOut();
  const { workspace, workspaceId, setActiveWorkspaceId } = useActiveWorkspace();
  const { scheme, setScheme, haptics, setHaptics } = useScheme();
  const [query, setQuery] = useState("");
  const [savingHide, setSavingHide] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const go = (href: string) => router.push(href as never);

  const load = useCallback(
    async (ws: string) => {
      const [sessions, accounts] = await Promise.all([
        session.listSessions().then((r) => (Array.isArray(r.data) ? r.data.length : null)).catch(() => null),
        session.listAccounts(ws).then((r) => (Array.isArray(r.data) ? (r.data as ApiAccount[]) : [])).catch(() => [] as ApiAccount[]),
      ]);
      return { sessions, linked: accounts.filter((a) => a.connectionType === "linked" && !a.archived).length };
    },
    [session],
  );
  const facts = useLiveQuery(load, { sessions: null as number | null, linked: 0 }, "settings-facts");

  const mfaOn = user?.totpEnabled === true;
  const hideAmounts = user?.hideLockScreenAmounts !== false;
  const done = [mfaOn, hideAmounts].filter(Boolean).length;
  const canRename = workspace?.role === "owner" || workspace?.role === "admin";
  const appearance = scheme === "dark" ? "dark" : scheme === "light" ? "light" : "system";
  const version = Constants.expoConfig?.version ?? "";

  const setHide = async (next: boolean) => {
    setSavingHide(true);
    try {
      await session.patchSettings(next);
    } finally {
      setSavingHide(false);
    }
  };

  const rename = async () => {
    const next = name.trim();
    if (!next || !workspaceId) {
      setRenameError("Enter a name.");
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await session.updateWorkspace(workspaceId, next);
      setRenameOpen(false);
    } catch {
      setRenameError("Couldn't rename the workspace. Try again.");
    } finally {
      setRenaming(false);
    }
  };

  const appearanceControl = (
    <View accessibilityRole="radiogroup" accessibilityLabel="Theme" style={{ flexDirection: "row", padding: 2, borderRadius: t.radius.radiusSm, backgroundColor: t.c.surfaceAlt }}>
      {(["system", "light", "dark"] as const).map((m) => {
        const on = appearance === m;
        return (
          <Pressable
            key={m}
            onPress={() => setScheme(m === "system" ? undefined : m)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{ paddingHorizontal: 10, height: 28, borderRadius: 8, justifyContent: "center", backgroundColor: on ? t.c.surface : "transparent" }}
          >
            <Txt variant="caption" color={on ? t.c.ink : t.c.inkMuted} style={{ fontWeight: on ? "600" : "400" }}>
              {m === "system" ? "System" : m === "light" ? "Light" : "Dark"}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );

  const groups: Group[] = [
    {
      title: "Account",
      tone: { fg: t.c.onPrimarySoft, bg: t.c.primarySoft },
      rows: [
        { key: "email", icon: "mail", label: "Email", keywords: "profile account", value: user?.email ?? "" },
        { key: "mfa", icon: "shield-check", label: "Two-step sign-in", keywords: "security authenticator 2fa mfa totp", value: mfaOn ? "On" : "Off", valueTone: mfaOn ? "muted" : "warning", onPress: () => go("/(tabs)/more/security") },
      ],
    },
    {
      title: workspace ? `Workspace · ${workspace.name}` : "Workspace",
      tone: { fg: t.c.catPurple, bg: t.c.catPurpleSoft },
      rows: [
        ...(canRename
          ? [{ key: "rename", icon: "pencil" as IconName, label: "Workspace name", keywords: "rename", value: workspace?.name, onPress: () => { setName(workspace?.name ?? ""); setRenameError(null); setRenameOpen(true); } }]
          : [{ key: "name", icon: "briefcase" as IconName, label: "Workspace", value: workspace?.name }]),
        ...(workspaces.length > 1
          ? [{ key: "switch", icon: "arrow-left-right" as IconName, label: "Switch workspace", value: `${workspaces.length} workspaces`, onPress: () => setSwitchOpen(true) }]
          : []),
      ],
    },
    {
      title: "Privacy and security",
      tone: { fg: t.c.catTeal, bg: t.c.catTealSoft },
      rows: [
        {
          key: "hide",
          icon: "eye-off",
          label: "Hide amounts on lock screen",
          keywords: "privacy notifications",
          control: <Toggle value={hideAmounts} disabled={savingHide} onChange={(v) => void setHide(v)} label="Hide amounts on lock screen" />,
        },
        { key: "sessions", icon: "smartphone", label: "Devices and sessions", keywords: "sign out revoke", value: facts.data.sessions != null ? `${facts.data.sessions} active` : undefined, onPress: () => go("/(tabs)/more/sessions") },
        { key: "lock", icon: "bell", label: "Lock-screen alerts", keywords: "notifications preview", onPress: () => go("/(tabs)/more/lock-screen") },
      ],
    },
    {
      title: "App",
      tone: { fg: t.c.catGold, bg: t.c.catGoldSoft },
      rows: [
        { key: "theme", icon: appearance === "dark" ? "moon" : "sun", label: "Appearance", keywords: "theme dark light mode", control: appearanceControl },
        { key: "haptics", icon: "smartphone", label: "Haptics", keywords: "vibration feedback", control: <Toggle value={haptics} onChange={setHaptics} label="Haptics" /> },
        { key: "reminders", icon: "clock", label: "Reminders", keywords: "notifications bills budgets summary", onPress: () => go("/(tabs)/more/notification-settings") },
      ],
    },
    {
      title: "Your data",
      tone: { fg: t.c.catSlate, bg: t.c.catSlateSoft },
      rows: [
        { key: "banks", icon: "landmark", label: "Linked banks", keywords: "connect mono bank link", value: facts.known ? (facts.data.linked ? `${facts.data.linked} linked` : "None") : undefined, onPress: () => go("/(tabs)/accounts/institution") },
        { key: "about", icon: "info", label: "Version", keywords: "about", value: version ? `MyLedja ${version}` : "MyLedja" },
      ],
    },
    {
      title: "Danger zone",
      tone: { fg: t.c.danger, bg: t.c.dangerSoft },
      danger: true,
      rows: [{ key: "delete", icon: "trash-2", label: "Delete account", keywords: "close remove", danger: true, onPress: () => { setDeleteError(null); setDeleteOpen(true); } }],
    },
  ];

  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, rows: q ? g.rows.filter((r) => `${r.label} ${r.keywords ?? ""} ${g.title}`.toLowerCase().includes(q)) : g.rows }))
    .filter((g) => g.rows.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: t.c.hero, paddingTop: insets.top + t.space.space3, paddingHorizontal: t.space.space4, paddingBottom: t.space.space4 }}>
          <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", gap: t.space.space3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more" as never))}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="chevron-left" size={18} color={t.c.onHero} />
              </Pressable>
              <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header">Settings</Txt>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, backgroundColor: t.c.heroDeco }}>
              <Icon name="search" size={16} color={t.c.onHeroMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search settings"
                placeholderTextColor={t.c.onHeroMuted}
                accessibilityLabel="Search settings"
                autoCorrect={false}
                style={[t.text("bodySm"), { flex: 1, color: t.c.onHero, paddingVertical: 0, minWidth: 0 }]}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
                  <Icon name="x" size={16} color={t.c.onHeroMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", padding: t.space.space4, gap: t.space.space4 }}>
          {!q ? (
            <Pressable
              onPress={() => go(mfaOn ? "/(tabs)/more/sessions" : "/(tabs)/more/security")}
              accessibilityRole="button"
              accessibilityLabel={`Secure your account, ${done} of 2 done`}
              style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, padding: t.space.space4, borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: done === 2 ? t.c.positiveSoft : t.c.warningSoft, alignItems: "center", justifyContent: "center" }}>
                <Icon name={done === 2 ? "circle-check" : "shield-check"} size={20} color={done === 2 ? t.c.positive : t.c.warning} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Txt variant="titleSm">{done === 2 ? "Your account is protected" : `Secure your account · ${done} of 2 done`}</Txt>
                <View style={{ flexDirection: "row", gap: 3 }}>
                  {[mfaOn, hideAmounts].map((on, i) => (
                    <View key={i} style={{ flex: 1, height: 5, borderRadius: 999, backgroundColor: on ? t.c.positive : t.c.surfaceAlt }} />
                  ))}
                </View>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {!mfaOn ? "Next: turn on two-step sign-in" : !hideAmounts ? "Next: hide amounts on your lock screen" : "Review the devices signed in to your account"}
                </Txt>
              </View>
              <Icon name="chevron-right" size={16} color={t.c.inkMuted} />
            </Pressable>
          ) : null}

          {shown.map((g) => (
            <View key={g.title} style={{ gap: t.space.space2 }}>
              <Txt variant="caption" color={g.danger ? t.c.danger : t.c.inkMuted} style={{ fontWeight: "600", paddingHorizontal: 4 }} accessibilityRole="header">{g.title}</Txt>
              <View style={g.danger ? { borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.danger, overflow: "hidden" } : undefined}>
                <ListCard>
                  {g.rows.map((r, i) => (
                    <SettingRow key={r.key} row={r} tone={g.tone} last={i === g.rows.length - 1} />
                  ))}
                </ListCard>
              </View>
            </View>
          ))}
          {q && shown.length === 0 ? (
            <Txt variant="body" color={t.c.inkMuted} style={{ textAlign: "center", paddingVertical: t.space.space6 }}>{`No setting matches "${query.trim()}"`}</Txt>
          ) : null}
        </View>
      </ScrollView>

      <Sheet title="Switch workspace" open={switchOpen} onClose={() => setSwitchOpen(false)}>
        <View style={{ gap: t.space.space2 }}>
          {workspaces.map((w) => {
            const on = w.id === workspace?.id;
            return (
              <Pressable
                key={w.id}
                onPress={() => {
                  setActiveWorkspaceId(w.id);
                  setSwitchOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, padding: t.space.space3, borderRadius: t.radius.radiusMd, backgroundColor: on ? t.c.primarySoft : t.c.surfaceAlt }}
              >
                <Icon name="briefcase" size={18} color={on ? t.c.onPrimarySoft : t.c.inkMuted} />
                <Txt variant="titleSm" color={on ? t.c.onPrimarySoft : t.c.ink} style={{ flex: 1 }}>{w.name}</Txt>
                {on ? <Icon name="check" size={18} color={t.c.onPrimarySoft} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      <Sheet title="Rename workspace" open={renameOpen} onClose={() => setRenameOpen(false)} footer={<Button fullWidth loading={renaming} onPress={() => void rename()}>Save name</Button>}>
        <TextField label="Workspace name" value={name} onChangeText={(v) => { setName(v); setRenameError(null); }} error={renameError ?? undefined} />
      </Sheet>

      <Dialog
        title="Delete account?"
        open={deleteOpen}
        tone="destructive"
        confirmLabel="Delete and sign out"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          void session
            .startDeletion()
            .then(() => signOut())
            .catch(() => setDeleteError("Couldn't start deletion. Check your connection and try again."));
        }}
      >
        <Txt color={t.c.inkMuted}>This starts deletion of your MyLedja account and signs this device out.</Txt>
      </Dialog>
      {deleteError ? (
        <View style={{ position: "absolute", left: t.space.space4, right: t.space.space4, bottom: insets.bottom + t.space.space6 }}>
          <Txt variant="caption" color={t.c.danger} style={{ textAlign: "center" }}>{deleteError}</Txt>
        </View>
      ) : null}
    </View>
  );
}
