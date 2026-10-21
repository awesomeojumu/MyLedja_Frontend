import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon, Sheet, SpringPressable, Txt, useTheme, type IconName } from "@/design";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useScheme, useSession, useSignOut } from "@/state";

/** "Ayo Bami" from "ayo.bami@x.com". The account only has an email, so the name is read from it. */
export function displayName(email?: string | null): string {
  const local = (email ?? "").split("@")[0];
  const words = local.split(/[._-]+/).filter((w) => /[a-z]/i.test(w));
  if (!words.length) return email || "Your account";
  return words.slice(0, 2).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function firstName(email?: string | null): string {
  const name = displayName(email);
  return name.includes("@") ? name : name.split(" ")[0];
}

export function initialsOf(email?: string | null): string {
  const name = displayName(email);
  if (name.includes("@") || name === "Your account") return (email ?? "?").slice(0, 2).toUpperCase();
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function MenuRow({ icon, label, onPress, right, danger, last }: { icon: IconName; label: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; last?: boolean }) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, minHeight: 50, paddingHorizontal: t.space.space4, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.c.border }}>
      <Icon name={icon} size={18} color={danger ? t.c.danger : t.c.inkMuted} />
      <Txt variant="body" color={danger ? t.c.danger : t.c.ink} style={{ flex: 1 }}>{label}</Txt>
      {right ?? (onPress ? <Icon name="chevron-right" size={16} color={t.c.inkMuted} /> : null)}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} android_ripple={{ color: t.c.surfaceAlt }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/**
 * The account menu behind the avatar: who's signed in, the workspace, quick switches and the usual account pages.
 * Available from the header of every main screen.
 */
export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const { user, session, workspaces } = useSession();
  const signOut = useSignOut();
  const { workspace, setActiveWorkspaceId } = useActiveWorkspace();
  const { scheme, setScheme } = useScheme();
  const [savingHide, setSavingHide] = useState(false);
  const [switching, setSwitching] = useState(false);
  const go = (href: string) => {
    onClose();
    router.push(href as never);
  };
  const hide = user?.hideLockScreenAmounts !== false;
  const appearance = scheme === "dark" ? "dark" : scheme === "light" ? "light" : "system";

  return (
    <Sheet title="Account" open={open} onClose={() => { setSwitching(false); onClose(); }}>
      <View style={{ gap: t.space.space4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
          <View style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: t.c.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Txt variant="titleSm" color={t.c.onPrimarySoft} style={{ fontWeight: "700" }}>{initialsOf(user?.email)}</Txt>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="titleSm" numberOfLines={1}>{displayName(user?.email)}</Txt>
            <Txt variant="caption" color={t.c.inkMuted} numberOfLines={1}>{user?.email ?? ""}</Txt>
          </View>
        </View>

        <View style={{ borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
          <MenuRow
            icon="briefcase"
            label={workspace ? `Workspace · ${workspace.name}` : "Workspace"}
            onPress={workspaces.length > 1 ? () => setSwitching((v) => !v) : undefined}
            right={workspaces.length > 1 ? <Icon name={switching ? "chevron-up" : "chevron-down"} size={16} color={t.c.inkMuted} /> : <View />}
          />
          {switching
            ? workspaces.map((w) => (
                <MenuRow
                  key={w.id}
                  icon={w.id === workspace?.id ? "circle-check" : "briefcase"}
                  label={w.name}
                  onPress={() => {
                    setActiveWorkspaceId(w.id);
                    setSwitching(false);
                  }}
                  right={<View />}
                />
              ))
            : null}
          <MenuRow
            icon="eye-off"
            label="Hide amounts on lock screen"
            right={
              <Pressable
                onPress={() => {
                  setSavingHide(true);
                  void session.patchSettings(!hide).finally(() => setSavingHide(false));
                }}
                disabled={savingHide}
                accessibilityRole="switch"
                accessibilityState={{ checked: hide, disabled: savingHide }}
                accessibilityLabel="Hide amounts on lock screen"
                hitSlop={8}
                style={{ width: 44, height: 26, borderRadius: 999, padding: 3, justifyContent: "center", backgroundColor: hide ? t.c.primary : t.c.surfaceAlt, borderWidth: hide ? 0 : 1, borderColor: t.c.borderStrong, opacity: savingHide ? 0.5 : 1 }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 999, alignSelf: hide ? "flex-end" : "flex-start", backgroundColor: hide ? t.c.onPrimary : t.c.surface, borderWidth: hide ? 0 : 1, borderColor: t.c.borderStrong }} />
              </Pressable>
            }
          />
          <MenuRow
            icon={appearance === "dark" ? "moon" : "sun"}
            label="Appearance"
            last
            right={
              <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ flexDirection: "row", padding: 2, borderRadius: t.radius.radiusSm, backgroundColor: t.c.surfaceAlt }}>
                {(["system", "light", "dark"] as const).map((m) => {
                  const on = appearance === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setScheme(m === "system" ? undefined : m)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={{ paddingHorizontal: 9, height: 26, borderRadius: 7, justifyContent: "center", backgroundColor: on ? t.c.surface : "transparent" }}
                    >
                      <Txt variant="caption" color={on ? t.c.ink : t.c.inkMuted} style={{ fontWeight: on ? "600" : "400" }}>
                        {m === "system" ? "Auto" : m === "light" ? "Light" : "Dark"}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
            }
          />
        </View>

        <View style={{ borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
          <MenuRow icon="settings" label="Settings" onPress={() => go("/(tabs)/more/settings")} />
          <MenuRow icon="shield-check" label="Security" onPress={() => go("/(tabs)/more/security")} />
          <MenuRow icon="wallet" label="Accounts" onPress={() => go("/(tabs)/accounts")} />
          <MenuRow icon="ellipsis" label="More" onPress={() => go("/(tabs)/more")} />
          <MenuRow icon="info" label="Help and support" onPress={() => go("/(tabs)/more/help")} last />
        </View>

        <Pressable
          onPress={() => {
            onClose();
            void signOut();
          }}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: t.space.space2 }}
        >
          <Icon name="arrow-right" size={16} color={t.c.danger} />
          <Txt variant="label" color={t.c.danger}>Sign out</Txt>
        </Pressable>
      </View>
    </Sheet>
  );
}

/**
 * The signed-in person's avatar for a screen header. Tapping it opens the account menu, so settings are one tap
 * away from any main screen. `onHero` styles it for the navy headers.
 */
export function ProfileButton({ size = 36, onHero = true }: { size?: number; onHero?: boolean }) {
  const t = useTheme();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <>
      <SpringPressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Account: ${displayName(user?.email)}. Open account menu`}
        hitSlop={6}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          backgroundColor: onHero ? t.c.heroDeco : t.c.primarySoft,
          borderWidth: onHero ? 1.5 : 0,
          borderColor: onHero ? t.c.onHeroMuted : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt variant="label" color={onHero ? t.c.onHero : t.c.onPrimarySoft} style={{ fontWeight: "700", fontSize: size < 34 ? 12 : 13 }}>
          {initialsOf(user?.email)}
        </Txt>
      </SpringPressable>
      <ProfileSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
