import { useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import {
  Badge,
  Banner,
  Button,
  Card,
  Select,
  TextField,
  Txt,
  useTheme,
} from "@/design";

// ============================================================================
// 138 · Help centre and FAQ
// ============================================================================
export function Screen138HelpFaq() {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>("faq-1");

  const faqs = [
    {
      id: "faq-1",
      category: "Getting started",
      q: "How does offline recording work in MyLedja?",
      a: "Everything you enter while offline is recorded in your phone's durable local outbox. When your connection returns, records sync automatically to the cloud once — never duplicate.",
    },
    {
      id: "faq-2",
      category: "Security",
      q: "Does MyLedja ask for my bank login credentials?",
      a: "Never. MyLedja is manual-first and uses read-only bank statement imports. We never ask for or store your internet banking passwords, PINs, or token codes.",
    },
    {
      id: "faq-3",
      category: "Budgets",
      q: "How do monthly envelopes and rollovers work?",
      a: "You can allocate money into category envelopes. At the end of the month, any unspent surplus or overspend deficit can be rolled forward into the next period or reset.",
    },
    {
      id: "faq-4",
      category: "Statements",
      q: "How do I import a bank statement?",
      a: "Go to Accounts → Import statement. You can upload CSV or PDF statements downloaded from your banking app. You will get a chance to review and categorize every line before saving.",
    },
    {
      id: "faq-5",
      category: "Privacy",
      q: "Who can see my financial records?",
      a: "Your records belong strictly to your private workspace. Other users on the same device or within your family cannot see your data unless explicitly invited as workspace members.",
    },
  ];

  const filtered = query.trim()
    ? faqs.filter(
        (f) =>
          f.q.toLowerCase().includes(query.toLowerCase()) ||
          f.a.toLowerCase().includes(query.toLowerCase()) ||
          f.category.toLowerCase().includes(query.toLowerCase()),
      )
    : faqs;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Help centre and FAQ
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Answers to frequently asked questions about tracking, privacy, and accounts.
      </Txt>

      <TextField
        label="Search articles"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. offline, import, budgets…"
      />

      <View style={{ gap: t.space.space3 }}>
        {filtered.map((item) => {
          const isOpen = expandedId === item.id;
          return (
            <Card key={item.id} flat>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.q}
                onPress={() => setExpandedId(isOpen ? null : item.id)}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ alignSelf: "flex-start", marginBottom: 4 }}>
                      <Badge tone="neutral">{item.category}</Badge>
                    </View>
                    <Txt variant="titleSm" style={{ fontWeight: "600" }}>{item.q}</Txt>
                  </View>
                  <Txt variant="titleSm" color={t.c.inkMuted}>{isOpen ? "▲" : "▼"}</Txt>
                </View>
              </Pressable>
              {isOpen ? (
                <View style={{ marginTop: t.space.space3, paddingTop: t.space.space2, borderTopWidth: 1, borderTopColor: t.c.border }}>
                  <Txt variant="body" color={t.c.ink}>
                    {item.a}
                  </Txt>
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ============================================================================
// 139 · Contact support
// ============================================================================
export function Screen139ContactSupport() {
  const t = useTheme();
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachLogs, setAttachLogs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Contact support
      </Txt>
      <Txt variant="body" color={t.c.inkMuted}>
        Need assistance with your account, transaction sync, or a bug? Our team is here to help.
      </Txt>
      {sent ? <Banner tone="positive" title="Support message sent. We'll reply via email shortly." /> : null}

      <Card flat title="Send a message">
        <Select
          label="Topic"
          value={category}
          onChange={setCategory}
          options={[
            { value: "general", label: "General question" },
            { value: "sync", label: "Sync or offline outbox" },
            { value: "import", label: "Bank statement import" },
            { value: "bug", label: "Report a bug" },
            { value: "feature", label: "Request a feature" },
          ]}
        />
        <TextField
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="Brief summary of your question"
        />
        <TextField
          label="Details"
          value={message}
          onChangeText={setMessage}
          placeholder="Describe what happened or what you need help with"
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
          <Txt variant="body">Attach diagnostic logs</Txt>
          <Switch value={attachLogs} onValueChange={setAttachLogs} />
        </View>
        <Button
          variant="primary"
          loading={busy}
          onPress={() => {
            setBusy(true);
            setTimeout(() => {
              setBusy(false);
              setSent(true);
              setSubject("");
              setMessage("");
              setTimeout(() => setSent(false), 5000);
            }, 1200);
          }}
        >
          Send message
        </Button>
      </Card>

      <Card flat title="Direct contact">
        <Txt variant="body">Email: support@myledja.com</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>Response time: usually under 24 hours Monday to Saturday.</Txt>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// 140 · Legal documents
// ============================================================================
export function Screen140LegalDocuments() {
  const t = useTheme();
  const [doc, setDoc] = useState("terms");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: t.space.space4, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">
        Legal documents
      </Txt>

      <Select
        label="Select document"
        value={doc}
        onChange={setDoc}
        options={[
          { value: "terms", label: "Terms of Service" },
          { value: "privacy", label: "Privacy Policy (NDPA)" },
          { value: "disclaimer", label: "Financial Disclaimer" },
          { value: "licenses", label: "Open-Source Licenses" },
        ]}
      />

      {doc === "terms" ? (
        <Card flat title="Terms of Service (v1.3 · Oct 2026)">
          <Txt variant="body">
            1. Acceptance of Terms{"\n"}
            By accessing or using MyLedja, you agree to be bound by these terms. If you do not agree, do not use the app.{"\n\n"}
            2. Scope of Service{"\n"}
            MyLedja provides tools for personal accounting, ledger entry, and financial organization. MyLedja does not provide investment advice or licensed financial brokerage services.{"\n\n"}
            3. User Responsibility{"\n"}
            You are responsible for safeguarding your credentials and the accuracy of all manual records entered into the application.
          </Txt>
        </Card>
      ) : null}

      {doc === "privacy" ? (
        <Card flat title="Privacy Policy & NDPA Compliance">
          <Txt variant="body">
            1. Data Controller{"\n"}
            Planexi Global Consult operates MyLedja in strict compliance with the Nigeria Data Protection Act (NDPA 2023).{"\n\n"}
            2. Financial Data Retention{"\n"}
            Your financial data is private to your workspace. We never sell personal identifiable records or transaction amounts to third-party advertisers.{"\n\n"}
            3. Right to Erasure{"\n"}
            You have the absolute right to permanently delete your account and all associated ledger records at any time via Settings → Permanent Deletion.
          </Txt>
        </Card>
      ) : null}

      {doc === "disclaimer" ? (
        <Card flat title="Financial Disclaimer">
          <Txt variant="body">
            MyLedja is an information management and budgeting assistant. Figures presented (including net worth, debt payoff forecasts, and savings projections) are estimates based on your entered data. They do not constitute formal banking advice or tax declarations.
          </Txt>
        </Card>
      ) : null}

      {doc === "licenses" ? (
        <Card flat title="Open-Source Software">
          <Txt variant="body">
            MyLedja is powered by open-source libraries including React Native, Expo, TypeScript, and SQLite. View all licenses at myledja.com/licenses.
          </Txt>
        </Card>
      ) : null}
    </ScrollView>
  );
}
