import { useCallback, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { readPublicConfig } from "../config";
import {
  Amount,
  AmountDisplay,
  AmountInput,
  Avatar,
  Badge,
  Banner,
  BarChart,
  BottomNav,
  BudgetTile,
  Button,
  Card,
  CategoryBreakdown,
  CategoryIcon,
  CategoryPicker,
  Chip,
  ChipGroup,
  DataTable,
  DatePicker,
  Dialog,
  EmptyState,
  FilterButton,
  HeroBalance,
  Icon,
  IconButton,
  ICON_NAMES,
  LineChart,
  Logo,
  LogoMark,
  NavRail,
  ProgressBar,
  ProgressRing,
  Rise,
  SectionHeader,
  SegmentedControl,
  Select,
  Sheet,
  Sidebar,
  Skeleton,
  SpringPressable,
  StatTile,
  StatusBadge,
  SummaryCard,
  Tabs,
  TextField,
  Toast,
  TransactionDetail,
  TransactionRow,
  Txt,
  cleanAmount,
  detailActions,
  formatMoney,
  haptic,
  toKobo,
  toneColors,
  toneSoft,
  useBackToClose,
  useTheme,
  type IconName,
} from "../design";

const PERIODS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const TABS = [
  { value: "all", label: "All", count: 12 },
  { value: "in", label: "In", count: 4 },
  { value: "out", label: "Out", count: 8 },
];

const CHIP_OPTIONS = [
  { value: "food", label: "Food & groceries", category: "Food & groceries" },
  { value: "transport", label: "Transport", category: "Transport" },
  { value: "rent", label: "Rent", category: "Rent" },
];

const ACCOUNT_OPTIONS = [
  { value: "gtb", label: "GTBank" },
  { value: "cash", label: "Cash" },
];

const BREAKDOWN = [
  { label: "Food & groceries", value: 45000, count: 8 },
  { label: "Transport", value: 18000, count: 12 },
  { label: "Rent", value: 120000, count: 1 },
];

const BAR_DATA = [
  { label: "Jul", value: 82000, compare: 76000 },
  { label: "Aug", value: 91000, compare: 82000 },
  { label: "Sep", value: 74500, compare: 91000 },
];

const TABLE_ROWS = [
  { id: "1", title: "Shoprite", amount: 12500.5 },
  { id: "2", title: "Salary", amount: 450000 },
];

function CatalogSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.space3, paddingHorizontal: t.space.space4 }}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

export function DesignCatalog() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const config = readPublicConfig();
  const [active, setActive] = useState("home");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("4500.50");
  const [hidden, setHidden] = useState(false);
  const [note, setNote] = useState("Shoprite run");
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  useBackToClose(sheetOpen, closeSheet);

  const isLarge = t.widthClass === "large";
  const isRail = t.widthClass === "medium" || t.widthClass === "expanded";
  const sampleSoft = toneSoft(t, "positive");
  const sampleCat = toneColors(t, "orange");
  const cleaned = cleanAmount("4,500.50");

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, flexDirection: isLarge || isRail ? "row" : "column" }}>
      {isLarge ? (
        <Sidebar active={active} onNavigate={setActive} workspace="Personal" />
      ) : null}
      {isRail ? (
        <NavRail
          active={active}
          onNavigate={setActive}
          fab={{ label: "Add transaction", onPress: () => setSheetOpen(true) }}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + t.space.space4,
            paddingBottom: t.space.space12,
            gap: t.space.space6,
          }}
        >
          <CatalogSection title="MyLedja catalog">
            <Logo size={32} />
            <LogoMark size={32} title="MyLedja mark" />
            <Txt variant="titleMd">Design system on {t.widthClass}</Txt>
            <Txt variant="bodySm" color={t.c.inkMuted}>
              {config.appEnv} · {config.apiUrl}
            </Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              {t.scheme} · {t.font} · haptics {t.haptics ? "on" : "off"}
            </Txt>
            <Txt>
              {formatMoney(1250450.5)} · kobo {String(toKobo(cleaned))} · cleaned {cleaned}
            </Txt>
            <View style={{ flexDirection: "row", gap: t.space.space2 }}>
              <View style={{ width: 28, height: 28, borderRadius: t.radius.radiusSm, backgroundColor: sampleSoft.bg }} />
              <View style={{ width: 28, height: 28, borderRadius: t.radius.radiusSm, backgroundColor: sampleCat.bg }} />
            </View>
          </CatalogSection>

          <CatalogSection title="Foundations">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space2, alignItems: "center" }}>
              <Icon name="house" label="Home" />
              <CategoryIcon category="Food & groceries" />
              <Avatar name="Ada Okafor" />
              <Badge tone="positive">Synced</Badge>
              <StatusBadge status="pending" />
              <StatusBadge status="failed" />
            </View>
            <View
              accessible
              accessibilityLabel="MyLedja icon set"
              style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space2 }}
            >
              {ICON_NAMES.map((name: IconName) => (
                <Icon key={name} name={name} size={16} />
              ))}
            </View>
          </CatalogSection>

          <CatalogSection title="Actions">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space2 }}>
              <Button icon="plus" onPress={() => haptic("start", t.haptics)}>
                Save expense
              </Button>
              <Button variant="secondary" onPress={() => setSheetOpen(true)}>
                Open sheet
              </Button>
              <Button variant="tertiary" onPress={() => setDialogOpen(true)}>
                Open dialog
              </Button>
              <Button variant="destructive">Delete</Button>
              <Button loading>Saving</Button>
              <Button disabled disabledReason="Enter an amount first">
                Save expense
              </Button>
              <IconButton icon="bell" label="Notifications" badge={2} />
              <FilterButton count={2} onPress={() => setSheetOpen(true)} />
              <Chip selected icon="check">
                This month
              </Chip>
            </View>
            <SegmentedControl label="Period" options={PERIODS} defaultValue="month" />
            <Tabs label="Direction" tabs={TABS} defaultValue="all" />
            <ChipGroup label="Categories" options={CHIP_OPTIONS} />
          </CatalogSection>

          <CatalogSection title="Surfaces">
            <Banner tone="warning" title="Rent is due in 3 days">
              ₦250,000.00 leaves GTBank on Sat 18 Oct.
            </Banner>
            <Toast message="Saved on device." action={{ label: "Undo", onPress: () => undefined }} />
            <Card title="Spending">
              <SummaryCard label="Spent this month" value={185500.25} kind="expense" delta={-4.2} goodWhenUp={false} />
            </Card>
            <EmptyState title="No transactions yet" action={{ label: "Add expense", icon: "plus", onPress: () => setSheetOpen(true) }}>
              Add your first expense to see it here.
            </EmptyState>
            <Skeleton variant="text" lines={2} />
            <Skeleton variant="amount" />
            <Skeleton variant="row" />
            <Skeleton variant="card" />
          </CatalogSection>

          <CatalogSection title="Inputs">
            <TextField label="Description" icon="search" value={note} onChangeText={setNote} />
            <AmountInput label="Inline amount" value={amount} onChange={setAmount} />
            <AmountDisplay value={amount} onChange={setAmount} kind="expense" />
            <Select label="Account" options={ACCOUNT_OPTIONS} defaultValue="gtb" />
            <CategoryPicker recent={["Food & groceries", "Transport", "Rent"]} defaultValue="Food & groceries" />
            <DatePicker today="2026-10-15" defaultValue="2026-10-15" noFuture />
          </CatalogSection>

          <CatalogSection title="Money">
            <HeroBalance
              value={842150.75}
              freshness="Updated 14:20"
              hidden={hidden}
              onToggleHidden={() => setHidden((prev) => !prev)}
              actions={[
                { label: "Add", icon: "plus", onPress: () => setSheetOpen(true) },
                { label: "Transfer", icon: "arrow-left-right", onPress: () => undefined },
              ]}
            />
            <Amount value={4500.5} kind="expense" size="lg" animate />
            <View style={{ flexDirection: "row", gap: t.space.space3 }}>
              <StatTile label="Spent" value={185500.25} kind="spent" icon="arrow-down-left" />
              <StatTile label="In" value={450000} kind="income" icon="arrow-up-right" />
            </View>
            <ProgressBar label="Transport" value={18000} max={20000} money />
            <ProgressRing value={18000} max={20000} label="Transport" />
            <View style={{ flexDirection: "row", gap: t.space.space3 }}>
              <BudgetTile category="Transport" value={18000} max={20000} />
              <BudgetTile category="Food & groceries" value={45000} max={40000} layout="row" />
            </View>
            <TransactionRow
              title="Shoprite"
              category="Food & groceries"
              account="GTBank"
              amount={12500.5}
              kind="expense"
              time="14:20"
            />
            <TransactionRow
              title="Salary"
              category="Salary"
              account="GTBank"
              amount={450000}
              kind="income"
              status="pending"
            />
            <TransactionDetail
              transaction={{
                title: "Shoprite",
                category: "Food & groceries",
                amount: 12500.5,
                kind: "expense",
                account: "GTBank",
                date: "Wed 15 Oct",
                status: "pending",
              }}
            />
          </CatalogSection>

          <CatalogSection title="Data">
            <CategoryBreakdown items={BREAKDOWN} />
            <BarChart title="Spending" data={BAR_DATA} series={["This year", "Last year"]} highlight="Sep" />
            <LineChart
              title="Cash over time"
              labels={["Jul", "Aug", "Sep"]}
              series={[
                { name: "Available", values: [720000, 780000, 842150.75] },
                { name: "Spent", values: [80000, 91000, 74500] },
                { name: "Plan", values: [90000, 90000, 90000] },
              ]}
            />
            <DataTable
              columns={[
                { key: "title", label: "Title" },
                {
                  key: "amount",
                  label: "Amount",
                  align: "right",
                  render: (row) => <Amount value={row.amount} />,
                },
              ]}
              rows={TABLE_ROWS}
              rowKey={(row) => row.id}
            />
          </CatalogSection>

          <CatalogSection title="Motion">
            <Rise>
              <SpringPressable
                hapticOn="select"
                onPress={() => haptic("success", t.haptics)}
                style={{
                  padding: t.space.space4,
                  borderRadius: t.radius.radiusMd,
                  backgroundColor: t.c.primarySoft,
                }}
              >
                <Txt color={t.c.onPrimarySoft}>Press for haptic success</Txt>
              </SpringPressable>
            </Rise>
          </CatalogSection>

          {isLarge ? null : (
            <CatalogSection title="Sidebar sample">
              <Sidebar active={active} onNavigate={setActive} workspace="Personal" />
            </CatalogSection>
          )}
          {isRail ? null : (
            <CatalogSection title="Nav rail sample">
              <NavRail active={active} onNavigate={setActive} fab={{ label: "Add transaction", onPress: () => setSheetOpen(true) }} />
            </CatalogSection>
          )}
          {isLarge || isRail ? (
            <CatalogSection title="Bottom nav sample">
              <BottomNav active={active} onNavigate={setActive} onAdd={() => setSheetOpen(true)} />
            </CatalogSection>
          ) : null}
        </ScrollView>
        {isLarge || isRail ? null : (
          <BottomNav active={active} onNavigate={setActive} onAdd={() => setSheetOpen(true)} />
        )}
      </View>

      <Sheet
        title="Add expense"
        open={sheetOpen}
        onClose={closeSheet}
        footer={<>{detailActions({ onEdit: closeSheet, onDelete: closeSheet })}</>}
      >
        <Txt>Dummy sheet so every surface is wired.</Txt>
      </Sheet>
      <Dialog
        title="Delete this transaction?"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
        confirmLabel="Delete"
        cancelLabel="Keep"
        tone="destructive"
      >
        This cannot be undone from here. Catalog only.
      </Dialog>
    </View>
  );
}
