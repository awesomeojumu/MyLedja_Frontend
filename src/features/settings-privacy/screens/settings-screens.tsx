import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  SegmentedControl,
  Select,
  TextField,
  Txt,
  useTheme,
} from "@/design";
import { SessionsPanel, DeleteAccountButton } from "@/lib/settings-sessions-panel";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useScheme, useSession, useSignOut } from "@/state";

// ============================================================================
// 122 · Profile
// ============================================================================
export function Screen122Profile() {
  const t = useTheme();
  const { user } = useSession();
  const [name, setName] = useState("Ayobami Adeyemi");
  const [phone, setPhone] = useState("+234 801 234 5678");
  const [saved, setSaved] = useState(false);

  const initials = (name || user?.email || "ML")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Profile
      </Txt>
      {saved ? <Banner tone="positive" title="Profile updated successfully." /> : null}

      <Card flat style={{ alignItems: "center", paddingVertical: t.space.space5, gap: t.space.space3 }}>
        <Avatar name={initials} size={64} />
        <Txt variant="titleMd">{name}</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          {user?.email ?? "ayobami@example.com"}
        </Txt>
        <Badge tone="positive">Verified user</Badge>
      </Card>

      <Card flat title="Personal details">
        <TextField label="Full name" value={name} onChangeText={setName} />
        <TextField label="Email address" value={user?.email ?? "ayobami@example.com"} helper="Email changes require re-verification." />
        <TextField label="Phone number" value={phone} onChangeText={setPhone} helper="Used for security verification and SMS alerts." />
        <Button
          variant="primary"
          onPress={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          }}
        >
          Save profile
        </Button>
      </Card>

      <Card flat title="Account information">
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>User ID</Txt>
          <Txt variant="caption" style={{ fontFamily: "monospace" }}>{user?.userId?.slice(0, 12) ?? "usr_20261019"}…</Txt>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Member since</Txt>
          <Txt variant="body">October 2026</Txt>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Account tier</Txt>
          <Txt variant="body">Early Access (Free)</Txt>
        </View>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 123 · Workspace switcher
// ============================================================================
export function Screen123WorkspaceSwitcher() {
  const t = useTheme();
  const { workspaces } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newKind, setNewKind] = useState("personal");

  const list = workspaces.length > 0 ? workspaces : [
    { id: "ws-personal", name: "Personal Finances", kind: "personal", role: "owner" as const },
    { id: "ws-family", name: "Adeyemi Household", kind: "family", role: "admin" as const },
    { id: "ws-biz", name: "Planexi Consult", kind: "business", role: "editor" as const },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Workspace switcher
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Switch between workspaces. Every transaction and account belongs to its own workspace.
      </Txt>

      <View style={{ gap: t.space.space3 }}>
        {list.map((ws) => {
          const isActive = ws.id === (activeWorkspace?.workspaceId ?? "ws-personal");
          return (
            <Card key={ws.id} flat style={{ borderColor: isActive ? t.c.primary : t.c.border, borderWidth: isActive ? 2 : 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ gap: 4, flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Txt variant="titleSm" style={{ fontWeight: "600" }}>{ws.name}</Txt>
                    {isActive ? <Badge tone="primary">Active</Badge> : null}
                  </View>
                  <Txt variant="caption" color={t.c.inkMuted}>
                    {ws.kind.charAt(0).toUpperCase() + ws.kind.slice(1)} · Role: {ws.role}
                  </Txt>
                </View>
                {!isActive ? (
                  <Button
                    variant="secondary"
                    onPress={() => activeWorkspace.setActiveWorkspaceId(ws.id)}
                  >
                    Switch
                  </Button>
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>

      <Button variant="secondary" onPress={() => setCreateOpen(true)}>
        + Create new workspace
      </Button>

      <Dialog
        open={createOpen}
        title="Create workspace"
        confirmLabel="Create"
        onClose={() => setCreateOpen(false)}
        onConfirm={() => {
          setCreateOpen(false);
          setNewWorkspaceName("");
        }}
      >
        <TextField label="Workspace name" value={newWorkspaceName} onChangeText={setNewWorkspaceName} placeholder="e.g. Side Hustle" />
        <Select
          label="Workspace type"
          value={newKind}
          onChange={setNewKind}
          options={[
            { value: "personal", label: "Personal" },
            { value: "family", label: "Family (Gated)" },
            { value: "business", label: "Business (Gated)" },
          ]}
        />
        <Txt variant="caption" color={t.c.inkMuted}>
          Family and business workspaces will support multiple shared contributors.
        </Txt>
      </Dialog>
    </ScrollView>
  );
}

// ============================================================================
// 124 · Workspace settings
// ============================================================================
export function Screen124WorkspaceSettings() {
  const t = useTheme();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [name, setName] = useState(activeWorkspace?.workspace?.name ?? "Personal Workspace");
  const [currency, setCurrency] = useState("NGN");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Workspace settings
      </Txt>
      {saved ? <Banner tone="positive" title="Workspace settings updated." /> : null}

      <Card flat title="General">
        <TextField label="Workspace name" value={name} onChangeText={setName} />
        <Select
          label="Base currency"
          value={currency}
          onChange={setCurrency}
          options={[
            { value: "NGN", label: "Nigerian Naira (NGN ₦)" },
            { value: "USD", label: "US Dollar (USD $)" },
            { value: "GBP", label: "British Pound (GBP £)" },
          ]}
        />
        <Select
          label="Timezone"
          value={timezone}
          onChange={setTimezone}
          options={[
            { value: "Africa/Lagos", label: "Africa/Lagos (WAT, UTC+1)" },
            { value: "UTC", label: "UTC" },
          ]}
        />
        <Button
          variant="primary"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              if (activeWorkspace?.workspaceId) {
                await session.updateWorkspace(activeWorkspace.workspaceId, name);
              }
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save settings
        </Button>
      </Card>

      <Card flat title="Workspace details">
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Workspace ID</Txt>
          <Txt variant="caption" style={{ fontFamily: "monospace" }}>{activeWorkspace?.workspaceId ?? "ws-default-01"}</Txt>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Data isolation</Txt>
          <Txt variant="body">Dedicated workspace scope</Txt>
        </View>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 125 · Members and roles
// ============================================================================
export function Screen125Members() {
  const t = useTheme();
  const { user } = useSession();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");

  const members = [
    { id: "m1", name: "You", email: user?.email ?? "ayobami@example.com", role: "Owner" },
    { id: "m2", name: "Folake Adeyemi", email: "folake@example.com", role: "Admin" },
    { id: "m3", name: "Accountant (Auditor)", email: "audit@taxfirm.ng", role: "Viewer" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Members and roles
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Manage who has access to this workspace and what actions they can take.
      </Txt>

      <View style={{ gap: t.space.space3 }}>
        {members.map((m) => (
          <Card key={m.id} flat>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ gap: 2 }}>
                <Txt variant="titleSm" style={{ fontWeight: "600" }}>{m.name}</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>{m.email}</Txt>
              </View>
              <Badge tone={m.role === "Owner" ? "primary" : m.role === "Admin" ? "primary" : "neutral"}>
                {m.role}
              </Badge>
            </View>
          </Card>
        ))}
      </View>

      <Button variant="primary" onPress={() => setInviteOpen(true)}>
        + Invite new member
      </Button>

      <Card flat title="Role permissions guide">
        <Txt variant="body" style={{ fontWeight: "600" }}>• Owner</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Full administrative control, billing, and permanent workspace deletion.</Txt>
        <Txt variant="body" style={{ fontWeight: "600", marginTop: 4 }}>• Admin</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Can add/remove members, manage bank accounts, and configure categories.</Txt>
        <Txt variant="body" style={{ fontWeight: "600", marginTop: 4 }}>• Editor</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Can record transactions, allocate budgets, and manage bills.</Txt>
        <Txt variant="body" style={{ fontWeight: "600", marginTop: 4 }}>• Viewer</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Read-only access to transaction history and financial reports.</Txt>
      </Card>

      <Dialog
        open={inviteOpen}
        title="Invite workspace member"
        confirmLabel="Send invite"
        onClose={() => setInviteOpen(false)}
        onConfirm={() => {
          setInviteOpen(false);
          setInviteEmail("");
        }}
      >
        <TextField label="Email address" value={inviteEmail} onChangeText={setInviteEmail} placeholder="colleague@example.com" />
        <Select
          label="Role"
          value={inviteRole}
          onChange={setInviteRole}
          options={[
            { value: "admin", label: "Admin" },
            { value: "editor", label: "Editor" },
            { value: "viewer", label: "Viewer (Read-only)" },
          ]}
        />
      </Dialog>
    </ScrollView>
  );
}

// ============================================================================
// 126 · Regional settings
// ============================================================================
export function Screen126Regional() {
  const t = useTheme();
  const [currency, setCurrency] = useState("NGN");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [weekStart, setWeekStart] = useState("monday");
  const [numberFormat, setNumberFormat] = useState("comma_dot");
  const [saved, setSaved] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Regional settings
      </Txt>
      {saved ? <Banner tone="positive" title="Regional preferences saved." /> : null}

      <Card flat title="Localization">
        <Select
          label="Primary currency"
          value={currency}
          onChange={setCurrency}
          options={[
            { value: "NGN", label: "Nigerian Naira (₦ NGN)" },
            { value: "USD", label: "US Dollar ($ USD)" },
            { value: "GBP", label: "British Pound (£ GBP)" },
            { value: "EUR", label: "Euro (€ EUR)" },
          ]}
        />
        <Select
          label="Date format"
          value={dateFormat}
          onChange={setDateFormat}
          options={[
            { value: "DD/MM/YYYY", label: "19/10/2026 (DD/MM/YYYY)" },
            { value: "YYYY-MM-DD", label: "2026-10-19 (ISO YYYY-MM-DD)" },
            { value: "MM/DD/YYYY", label: "10/19/2026 (MM/DD/YYYY)" },
          ]}
        />
        <Select
          label="First day of the week"
          value={weekStart}
          onChange={setWeekStart}
          options={[
            { value: "monday", label: "Monday" },
            { value: "sunday", label: "Sunday" },
          ]}
        />
        <Select
          label="Number format"
          value={numberFormat}
          onChange={setNumberFormat}
          options={[
            { value: "comma_dot", label: "1,234,567.89 (Standard)" },
            { value: "space_dot", label: "1 234 567.89" },
          ]}
        />
        <Button
          variant="primary"
          onPress={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          }}
        >
          Save preferences
        </Button>
      </Card>

      <Card flat title="Format preview">
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Currency display</Txt>
          <Txt variant="body" style={{ fontWeight: "600" }}>₦250,000.00</Txt>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Date display</Txt>
          <Txt variant="body">19 Oct 2026</Txt>
        </View>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 127 · Security overview
// ============================================================================
export function Screen127SecurityOverview() {
  const t = useTheme();
  const { user } = useSession();
  const mfaOn = user?.totpEnabled === true;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Security overview
      </Txt>

      <Card flat style={{ gap: t.space.space3, padding: t.space.space4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Txt variant="titleSm" style={{ fontWeight: "600" }}>Security health score</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>4 of 5 safeguards active</Txt>
          </View>
          <Badge tone="positive">Strong</Badge>
        </View>
      </Card>

      <Card flat title="Protection checklist">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Strong password</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Meets 10+ character requirement</Txt>
          </View>
          <Badge tone="positive">Active</Badge>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Two-factor authentication (MFA)</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>{mfaOn ? "Authenticator app active" : "Not enabled"}</Txt>
          </View>
          <Badge tone={mfaOn ? "positive" : "neutral"}>{mfaOn ? "Enabled" : "Off"}</Badge>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Lock-screen amount masking</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>{user?.hideLockScreenAmounts !== false ? "Amounts hidden on lock screen" : "Visible"}</Txt>
          </View>
          <Badge tone={user?.hideLockScreenAmounts !== false ? "positive" : "warning"}>
            {user?.hideLockScreenAmounts !== false ? "Protected" : "Exposed"}
          </Badge>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Device session isolation</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Tokens stored in secure hardware Keystore</Txt>
          </View>
          <Badge tone="positive">Hardware verified</Badge>
        </View>
      </Card>

      <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.border, padding: t.space.space4 }}>
        <SessionsPanel />
      </View>
    </ScrollView>
  );
}

// ============================================================================
// 128 · Sessions and devices
// ============================================================================
export function Screen128SessionsDevices() {
  const t = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Sessions and devices
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Review devices currently signed in to your MyLedja account. Revoke any session you do not recognize.
      </Txt>

      <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.border, padding: t.space.space4 }}>
        <SessionsPanel />
      </View>

      <Card flat title="Session security policy">
        <Txt variant="caption" color={t.c.inkMuted}>
          • Refresh tokens rotate on every session refresh.{"\n"}
          • Revoking a device terminates its access immediately.{"\n"}
          • Offline devices are forced to re-authenticate as soon as they reconnect.
        </Txt>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 129 · Credentials and recovery
// ============================================================================
export function Screen129CredentialsRecovery() {
  const t = useTheme();
  const { user } = useSession();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Credentials and recovery
      </Txt>
      {pwSaved ? <Banner tone="positive" title="Password changed successfully." /> : null}
      {pwError ? <Banner tone="danger" title={pwError} /> : null}

      <Card flat title="Change password">
        <TextField label="Current password" value={currentPw} onChangeText={setCurrentPw} secureTextEntry />
        <TextField label="New password" value={newPw} onChangeText={setNewPw} secureTextEntry helper="Minimum 10 characters." />
        <TextField label="Confirm new password" value={confirmPw} onChangeText={setConfirmPw} secureTextEntry />
        <Button
          variant="primary"
          onPress={() => {
            setPwError(null);
            if (!currentPw || !newPw) {
              setPwError("Fill in all password fields.");
              return;
            }
            if (newPw.length < 10) {
              setPwError("New password must be at least 10 characters.");
              return;
            }
            if (newPw !== confirmPw) {
              setPwError("Passwords do not match.");
              return;
            }
            setCurrentPw("");
            setNewPw("");
            setConfirmPw("");
            setPwSaved(true);
            setTimeout(() => setPwSaved(false), 3000);
          }}
        >
          Update password
        </Button>
      </Card>

      <Card flat title="Recovery channels">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Recovery email</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>{user?.email ?? "ayobami@example.com"}</Txt>
          </View>
          <Badge tone="positive">Verified</Badge>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Passkeys (FIDO2 / WebAuthn)</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Sign in with biometrics on supported hardware</Txt>
          </View>
          <Button variant="secondary">Set up passkey</Button>
        </View>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 130 · Privacy centre
// ============================================================================
export function Screen130PrivacyCentre() {
  const t = useTheme();
  const { user, session } = useSession();
  const [telemetry, setTelemetry] = useState(false);
  const hideAmounts = user?.hideLockScreenAmounts !== false;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Privacy centre
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Your money data belongs exclusively to you. Control visibility and reporting here.
      </Txt>

      <Card flat title="Lock-screen privacy">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Hide amounts on lock screen</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              When enabled, push notifications and lock-screen cards mask amounts as ₦••••••.
            </Txt>
          </View>
          <Switch
            value={hideAmounts}
            onValueChange={async (val: boolean) => {
              await session.patchSettings(val);
            }}
          />
        </View>

        <Card flat style={{ backgroundColor: t.c.surfaceAlt, marginTop: t.space.space3 }}>
          <Txt variant="caption" style={{ fontWeight: "600" }}>Preview</Txt>
          <Txt variant="body">
            {hideAmounts ? "₦•••••• due tomorrow (DSTV Premium)" : "₦45,000.00 due tomorrow (DSTV Premium)"}
          </Txt>
        </Card>
      </Card>

      <Card flat title="Data sharing & telemetry">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Anonymous crash diagnostics</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              Helps us fix crashes. Never includes financial figures, bank names, or account numbers.
            </Txt>
          </View>
          <Switch value={telemetry} onValueChange={setTelemetry} />
        </View>
      </Card>

      <Card flat title="MyLedja Privacy Promise">
        <Txt variant="caption" color={t.c.inkMuted}>
          1. We never ask for or store your online banking credentials.{"\n"}
          2. Your data is isolated per workspace and never combined.{"\n"}
          3. We do not sell user data to advertising or marketing brokers.
        </Txt>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 131 · Export data
// ============================================================================
export function Screen131ExportData() {
  const t = useTheme();
  const [format, setFormat] = useState("csv");
  const [range, setRange] = useState("all");
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Export data
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Download your entire transaction history, accounts, and budgets in open formats.
      </Txt>
      {exported ? <Banner tone="positive" title="Export ready. Check your downloads." /> : null}

      <Card flat title="Export format">
        <Select
          label="File format"
          value={format}
          onChange={setFormat}
          options={[
            { value: "csv", label: "CSV (Comma Separated Values)" },
            { value: "json", label: "JSON (Complete Ledger Backup)" },
            { value: "xlsx", label: "Excel Spreadsheet (.xlsx)" },
          ]}
        />
        <Select
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: "all", label: "All time" },
            { value: "year", label: "This year (2026)" },
            { value: "month", label: "Last 30 days" },
          ]}
        />
        <Button
          variant="primary"
          loading={busy}
          onPress={() => {
            setBusy(true);
            setTimeout(() => {
              setBusy(false);
              setExported(true);
              setTimeout(() => setExported(false), 4000);
            }, 1200);
          }}
        >
          Generate and download export
        </Button>
      </Card>

      <Card flat title="Data included in export">
        <Txt variant="caption" color={t.c.inkMuted}>
          • Accounts and current balances{"\n"}
          • All posted and pending transactions with categories and merchant tags{"\n"}
          • Recurring bills and schedule details{"\n"}
          • Budget allocations and historical spend records
        </Txt>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 132 · Deactivate account
// ============================================================================
export function Screen132DeactivateAccount() {
  const t = useTheme();
  const signOut = useSignOut();
  const [confirm, setConfirm] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Deactivate account
      </Txt>

      <Card flat title="Temporary account pause">
        <Txt variant="body">
          Deactivating temporarily turns off your account without permanently erasing your records.
        </Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          • All active device sessions will be signed out immediately.{"\n"}
          • Email and push notifications will be paused.{"\n"}
          • Your financial data stays safely encrypted in cold storage.{"\n"}
          • You can reactivate anytime simply by signing in again.
        </Txt>
        <Button variant="secondary" onPress={() => setConfirm(true)}>
          Deactivate account
        </Button>
      </Card>

      <Dialog
        open={confirm}
        title="Deactivate account"
        tone="destructive"
        confirmLabel="Deactivate and sign out"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await signOut();
        }}
      >
        <Txt color={t.c.inkMuted}>
          Are you sure you want to pause your account? You will be signed out of this device.
        </Txt>
      </Dialog>
    </ScrollView>
  );
}

// ============================================================================
// 133 · Permanent deletion
// ============================================================================
export function Screen133PermanentDeletion() {
  const t = useTheme();
  const signOut = useSignOut();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Permanent deletion
      </Txt>

      <Banner tone="danger" title="Irreversible action: all financial records will be permanently destroyed." />

      <Card flat title="What happens when you delete">
        <Txt variant="body" color={t.c.inkMuted}>
          • All workspaces owned by you will be purged.{"\n"}
          • All recorded bank accounts, cash accounts, and transactions will be erased immediately.{"\n"}
          • Your login credentials, sessions, and recovery codes will be revoked.{"\n"}
          • Any active subscription or plan will be cancelled.{"\n"}
          • This action cannot be reversed. Please export your data first.
        </Txt>
      </Card>

      <View style={{ gap: t.space.space2 }}>
        <DeleteAccountButton onDeleted={signOut} />
      </View>
    </ScrollView>
  );
}

// ============================================================================
// 134 · Integrations
// ============================================================================
export function Screen134Integrations() {
  const t = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Integrations
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Manage connected banking services, statement sync, and external data tools.
      </Txt>

      <Card flat>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="titleSm" style={{ fontWeight: "600" }}>Mono Financial API</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Open banking aggregation for Nigerian banks</Txt>
          </View>
          <Badge tone="primary">Ready</Badge>
        </View>
        <Txt variant="caption" color={t.c.inkMuted} style={{ marginTop: 8 }}>
          Connect your GTBank, Access, Zenith, or Kuda accounts for automatic statement imports.
        </Txt>
      </Card>

      <Card flat>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="titleSm" style={{ fontWeight: "600" }}>CSV Statement Import</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Offline manual bank statement parser</Txt>
          </View>
          <Badge tone="positive">Active</Badge>
        </View>
      </Card>

      <Card flat>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="titleSm" style={{ fontWeight: "600" }}>Calendar sync for bills</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Add recurring bill due dates to your phone calendar</Txt>
          </View>
          <Button variant="secondary">Configure</Button>
        </View>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 135 · Subscription and plan
// ============================================================================
export function Screen135SubscriptionPlan() {
  const t = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Subscription and plan
      </Txt>

      <Card flat style={{ gap: t.space.space2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt variant="titleSm" style={{ fontWeight: "600" }}>Current plan</Txt>
          <Badge tone="primary">Early Access</Badge>
        </View>
        <Txt variant="titleLg" style={{ color: t.c.primary, fontWeight: "700" }}>
          Free Launch Tier
        </Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          Enjoy full access to manual accounting, offline outbox, and unlimited accounts during our early access release.
        </Txt>
      </Card>

      <Card flat title="Features included">
        <Txt variant="body">✓ Unlimited bank & cash accounts</Txt>
        <Txt variant="body">✓ Offline-first ledger with durable sync</Txt>
        <Txt variant="body">✓ Envelope budgeting & category tracking</Txt>
        <Txt variant="body">✓ Recurring bills & reminders</Txt>
        <Txt variant="body">✓ CSV statement import with preview</Txt>
      </Card>

      <Card flat title="Upcoming: MyLedja Pro">
        <Txt variant="caption" color={t.c.inkMuted}>
          Soon: Automated multi-bank live sync, receipt OCR scanning, shared family workspaces, and advanced tax reporting.
        </Txt>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 136 · App preferences
// ============================================================================
export function Screen136AppPreferences() {
  const t = useTheme();
  const { scheme, setScheme } = useScheme();
  const [haptics, setHaptics] = useState(true);
  const [sounds, setSounds] = useState(false);
  const [defaultTab, setDefaultTab] = useState("home");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        App preferences
      </Txt>

      <Card flat title="Appearance">
        <SegmentedControl
          label="Theme"
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          value={scheme === "dark" ? "dark" : "light"}
          onChange={(value) => setScheme(value === "dark" ? "dark" : "light")}
        />
      </Card>

      <Card flat title="Feedback & Haptics">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Haptic vibration</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Gentle vibration on key taps and transaction saves</Txt>
          </View>
          <Switch value={haptics} onValueChange={setHaptics} />
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Txt variant="body" style={{ fontWeight: "600" }}>Sound effects</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Play audio cues on successful sync</Txt>
          </View>
          <Switch value={sounds} onValueChange={setSounds} />
        </View>
      </Card>

      <Card flat title="Startup">
        <Select
          label="Default landing screen"
          value={defaultTab}
          onChange={setDefaultTab}
          options={[
            { value: "home", label: "Home (Dashboard)" },
            { value: "transactions", label: "Transactions" },
            { value: "plan", label: "Plan & Budgets" },
          ]}
        />
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 137 · About, legal and diagnostics
// ============================================================================
export function Screen137AboutDiagnostics() {
  const t = useTheme();
  const [cacheCleared, setCacheCleared] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        About, legal and diagnostics
      </Txt>
      {cacheCleared ? <Banner tone="positive" title="Local cache cleared." /> : null}

      <Card flat style={{ alignItems: "center", paddingVertical: t.space.space4, gap: 4 }}>
        <Txt variant="titleMd" style={{ fontWeight: "700" }}>MyLedja</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Version 1.0.0 (Build 2026.10.19)</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Personal Finance Tracker for Nigeria</Txt>
      </Card>

      <Card flat title="Diagnostics">
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Engine</Txt>
          <Txt variant="body">React Native / Expo</Txt>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Offline store</Txt>
          <Txt variant="body">Durable SQLite Outbox</Txt>
        </View>
        <View style={{ height: 1, backgroundColor: t.c.border }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="body" color={t.c.inkMuted}>Architecture</Txt>
          <Txt variant="body">Spec v1.3 Verified</Txt>
        </View>
        <Button
          variant="secondary"
          onPress={() => {
            setCacheCleared(true);
            setTimeout(() => setCacheCleared(false), 3000);
          }}
        >
          Clear local cache
        </Button>
      </Card>

      <Card flat title="Legal & Compliance">
        <Txt variant="body" style={{ fontWeight: "600" }}>Terms of Service</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Governs your use of the MyLedja platform.</Txt>
        <Txt variant="body" style={{ fontWeight: "600", marginTop: 6 }}>Privacy Policy</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Complies with the Nigeria Data Protection Act (NDPA).</Txt>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 144 · New device and suspicious sign-in review
// ============================================================================
export function Screen144SuspiciousSignins() {
  const t = useTheme();
  const [resolved, setResolved] = useState<Record<string, "trusted" | "revoked">>({});

  const events = [
    { id: "ev-1", device: "Chrome 128 on macOS", location: "Lagos, Nigeria", ip: "102.89.44.12", time: "Today, 14:22", flagged: false },
    { id: "ev-2", device: "iPhone 15 Pro", location: "Abuja, Nigeria", ip: "197.210.55.8", time: "Yesterday, 09:15", flagged: true },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        New device and suspicious sign-in review
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Review sign-ins from new or unrecognized locations. Confirm your identity or secure your account.
      </Txt>

      <View style={{ gap: t.space.space3 }}>
        {events.map((ev) => {
          const state = resolved[ev.id];
          return (
            <Card key={ev.id} flat style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="titleSm" style={{ fontWeight: "600" }}>{ev.device}</Txt>
                <Badge tone={ev.flagged ? "warning" : "neutral"}>
                  {ev.flagged ? "New location" : "Recognized"}
                </Badge>
              </View>
              <Txt variant="caption" color={t.c.inkMuted}>
                {ev.location} · {ev.ip} · {ev.time}
              </Txt>

              {state ? (
                <Banner tone={state === "trusted" ? "positive" : "danger"} title={state === "trusted" ? "Marked as trusted." : "Session revoked."} />
              ) : (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <Button
                    variant="primary"
                    onPress={() => setResolved((prev) => ({ ...prev, [ev.id]: "trusted" }))}
                  >
                    This was me
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => setResolved((prev) => ({ ...prev, [ev.id]: "revoked" }))}
                  >
                    Not me - Revoke
                  </Button>
                </View>
              )}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}
