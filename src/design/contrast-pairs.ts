import type { ColorTokens } from "@/design/tokens";

export type ContrastRole = "text" | "ui" | "hairline";
export type TokenName = keyof ColorTokens;

export interface ContrastPair {
  component: string;
  state: string;
  fg: TokenName;
  bg: TokenName;
  role: ContrastRole;
}

export const EXEMPT_COMPONENTS: Record<string, string> = {
  Skeleton: "no text or icon color",
  Rise: "does not paint its own colors",
  SpringPressable: "does not paint its own colors",
};

export const HELPER_EXPORTS = new Set(["toneColors", "toneSoft", "useBackToClose", "detailActions"]);

function text(component: string, state: string, fg: TokenName, bg: TokenName): ContrastPair {
  return { component, state, fg, bg, role: "text" };
}

function ui(component: string, state: string, fg: TokenName, bg: TokenName): ContrastPair {
  return { component, state, fg, bg, role: "ui" };
}

function hairline(component: string, state: string, fg: TokenName, bg: TokenName): ContrastPair {
  return { component, state, fg, bg, role: "hairline" };
}

const CAT: { name: string; fg: TokenName; bg: TokenName }[] = [
  { name: "orange", fg: "catOrange", bg: "catOrangeSoft" },
  { name: "teal", fg: "catTeal", bg: "catTealSoft" },
  { name: "pink", fg: "catPink", bg: "catPinkSoft" },
  { name: "gold", fg: "catGold", bg: "catGoldSoft" },
  { name: "green", fg: "catGreen", bg: "catGreenSoft" },
  { name: "purple", fg: "catPurple", bg: "catPurpleSoft" },
  { name: "sky", fg: "catSky", bg: "catSkySoft" },
  { name: "slate", fg: "catSlate", bg: "catSlateSoft" },
];

const BADGE: { tone: string; fg: TokenName; bg: TokenName }[] = [
  { tone: "neutral", fg: "inkMuted", bg: "surfaceAlt" },
  { tone: "primary", fg: "onPrimarySoft", bg: "primarySoft" },
  { tone: "positive", fg: "positive", bg: "positiveSoft" },
  { tone: "warning", fg: "warning", bg: "warningSoft" },
  { tone: "danger", fg: "danger", bg: "dangerSoft" },
  { tone: "transfer", fg: "transfer", bg: "transferSoft" },
];

const BANNER_TONES: { tone: string; fg: TokenName; bg: TokenName }[] = [
  { tone: "neutral", fg: "inkMuted", bg: "surfaceAlt" },
  { tone: "primary", fg: "onPrimarySoft", bg: "primarySoft" },
  { tone: "positive", fg: "positive", bg: "positiveSoft" },
  { tone: "warning", fg: "warning", bg: "warningSoft" },
  { tone: "danger", fg: "danger", bg: "dangerSoft" },
];

const STATUS: { status: string; fg: TokenName; bg: TokenName }[] = [
  { status: "synced", fg: "inkMuted", bg: "surfaceAlt" },
  { status: "pending", fg: "onPrimarySoft", bg: "primarySoft" },
  { status: "syncing", fg: "onPrimarySoft", bg: "primarySoft" },
  { status: "failed", fg: "danger", bg: "dangerSoft" },
  { status: "conflict", fg: "warning", bg: "warningSoft" },
  { status: "offline", fg: "inkMuted", bg: "surfaceAlt" },
  { status: "estimate", fg: "warning", bg: "warningSoft" },
  { status: "reconciled", fg: "positive", bg: "positiveSoft" },
];

export const PAIRS: ContrastPair[] = [
  text("Txt", "body-on-bg", "ink", "bg"),
  text("Txt", "body-on-surface", "ink", "surface"),
  text("Txt", "muted-on-bg", "inkMuted", "bg"),
  text("Txt", "muted-on-surface", "inkMuted", "surface"),

  ui("Icon", "default-on-bg", "ink", "bg"),
  ui("Icon", "muted-on-bg", "inkMuted", "bg"),
  ui("Icon", "default-on-surface", "ink", "surface"),

  ui("LogoMark", "default-stem", "primary", "bg"),
  ui("LogoMark", "default-entries", "chart2", "bg"),
  ui("LogoMark", "default-kobo", "catOrange", "bg"),
  ui("LogoMark", "onHero-stem", "onHero", "hero"),
  ui("LogoMark", "onHero-entries", "onHeroMuted", "hero"),
  ui("LogoMark", "onHero-kobo", "onHero", "hero"),

  text("Logo", "wordmark", "ink", "bg"),
  text("Logo", "wordmark-onHero", "onHero", "hero"),
  ui("Logo", "mark-stem", "primary", "bg"),
  ui("Logo", "mark-onHero", "onHero", "hero"),

  ...CAT.map((c) => ui("CategoryIcon", c.name, c.fg, c.bg)),
  ui("CategoryIcon", "transfer", "transfer", "transferSoft"),

  ...CAT.filter((c) => c.name !== "slate").map((c) => text("Avatar", `initials-${c.name}`, c.fg, c.bg)),

  ...BADGE.flatMap((b) => [
    text("Badge", `${b.tone}-label`, b.fg, b.bg),
    ui("Badge", `${b.tone}-icon`, b.fg, b.bg),
  ]),

  ...STATUS.map((s) => text("StatusBadge", s.status, s.fg, s.bg)),

  text("Button", "primary", "onPrimary", "primary"),
  ui("Button", "primary-icon", "onPrimary", "primary"),
  text("Button", "secondary", "ink", "surface"),
  ui("Button", "secondary-border", "borderStrong", "surface"),
  text("Button", "tertiary", "primary", "bg"),
  text("Button", "destructive", "surface", "danger"),
  text("Button", "disabledReason", "inkMuted", "bg"),

  ui("IconButton", "ghost", "ink", "bg"),
  ui("IconButton", "filled", "onPrimarySoft", "primarySoft"),
  text("IconButton", "badge", "surface", "danger"),

  text("SegmentedControl", "selected", "ink", "surface"),
  text("SegmentedControl", "idle", "inkMuted", "surfaceAlt"),

  text("Tabs", "selected", "ink", "bg"),
  text("Tabs", "idle", "inkMuted", "bg"),
  text("Tabs", "count-selected", "ink", "surfaceAlt"),
  text("Tabs", "count-idle", "inkMuted", "surfaceAlt"),
  ui("Tabs", "underline", "primary", "bg"),
  hairline("Tabs", "border", "border", "bg"),

  text("Chip", "selected", "onPrimarySoft", "primarySoft"),
  ui("Chip", "selected-border", "primary", "primarySoft"),
  ui("Chip", "selected-check", "onPrimarySoft", "primarySoft"),
  text("Chip", "idle", "ink", "surface"),
  ui("Chip", "idle-border", "borderStrong", "surface"),
  text("Chip", "count", "inkMuted", "surface"),

  text("ChipGroup", "selected", "onPrimarySoft", "primarySoft"),
  text("ChipGroup", "idle", "ink", "surface"),

  text("FilterButton", "label", "ink", "surface"),
  ui("FilterButton", "icon", "ink", "surface"),
  ui("FilterButton", "idle-border", "borderStrong", "surface"),
  ui("FilterButton", "active-border", "ink", "surface"),
  text("FilterButton", "count", "onPrimary", "primary"),

  text("Card", "title", "ink", "surface"),
  ui("Card", "border", "borderStrong", "surface"),

  text("SectionHeader", "title", "ink", "bg"),
  text("SectionHeader", "meta", "inkMuted", "bg"),
  text("SectionHeader", "action", "primary", "bg"),

  text("Sheet", "title", "ink", "surface"),
  ui("Sheet", "close", "ink", "surface"),
  ui("Sheet", "handle", "borderStrong", "surface"),
  hairline("Sheet", "footer-border", "border", "surface"),

  text("Dialog", "title", "ink", "surface"),
  text("Dialog", "body", "inkMuted", "surface"),
  ui("Dialog", "destructive-icon", "danger", "dangerSoft"),

  ...BANNER_TONES.flatMap((b) => [
    ui("Banner", `${b.tone}-icon`, b.fg, b.bg),
    text("Banner", `${b.tone}-title`, "ink", b.bg),
    text("Banner", `${b.tone}-body`, "ink", b.bg),
    text("Banner", `${b.tone}-action`, "primary", b.bg),
  ]),

  text("Toast", "message", "bg", "ink"),
  ui("Toast", "icon", "bg", "ink"),
  text("Toast", "action", "bg", "ink"),

  ui("EmptyState", "icon", "onPrimarySoft", "primarySoft"),
  text("EmptyState", "title", "ink", "bg"),
  text("EmptyState", "body", "inkMuted", "bg"),

  text("TextField", "label", "ink", "bg"),
  text("TextField", "value", "ink", "surface"),
  text("TextField", "placeholder", "inkMuted", "surface"),
  text("TextField", "helper", "inkMuted", "bg"),
  text("TextField", "error", "danger", "bg"),
  ui("TextField", "icon", "inkMuted", "surface"),
  ui("TextField", "border", "borderStrong", "surface"),
  ui("TextField", "focus", "focus", "surface"),
  ui("TextField", "error-border", "danger", "surface"),

  text("AmountInput", "label", "ink", "bg"),
  text("AmountInput", "value", "ink", "surface"),
  text("AmountInput", "naira", "inkMuted", "surface"),
  text("AmountInput", "currency", "inkMuted", "surface"),
  text("AmountInput", "error", "danger", "bg"),
  ui("AmountInput", "border", "borderStrong", "surface"),

  text("AmountDisplay", "neutral", "ink", "bg"),
  text("AmountDisplay", "income", "positive", "bg"),
  text("AmountDisplay", "expense", "negative", "bg"),
  text("AmountDisplay", "transfer", "transfer", "bg"),
  text("AmountDisplay", "empty", "inkMuted", "bg"),
  text("AmountDisplay", "ghost-kobo", "inkMuted", "bg"),
  text("AmountDisplay", "error", "danger", "bg"),
  ui("AmountDisplay", "focus", "focus", "bg"),
  ui("AmountDisplay", "underline", "borderStrong", "bg"),

  text("Select", "label", "ink", "bg"),
  text("Select", "value", "ink", "surface"),
  text("Select", "placeholder", "inkMuted", "surface"),
  ui("Select", "chevron", "inkMuted", "surface"),
  ui("Select", "border", "borderStrong", "surface"),
  text("Select", "option", "ink", "surface"),
  text("Select", "option-selected", "ink", "surfaceAlt"),
  ui("Select", "check", "primary", "surfaceAlt"),

  text("CategoryPicker", "label", "ink", "bg"),
  text("CategoryPicker", "value", "ink", "surface"),
  text("CategoryPicker", "all-count", "inkMuted", "surface"),
  ui("CategoryPicker", "border", "borderStrong", "surface"),
  ui("CategoryPicker", "check", "primary", "surfaceAlt"),
  text("CategoryPicker", "empty", "inkMuted", "surface"),

  text("DatePicker", "month", "ink", "surface"),
  text("DatePicker", "weekday", "inkMuted", "surface"),
  text("DatePicker", "day", "ink", "surface"),
  text("DatePicker", "selected", "onPrimary", "primary"),
  ui("DatePicker", "disabled-future", "borderStrong", "surface"),
  ui("DatePicker", "today-ring", "primary", "surface"),
  ui("DatePicker", "border", "borderStrong", "surface"),

  text("Amount", "neutral", "ink", "surface"),
  text("Amount", "income", "positive", "surface"),
  text("Amount", "expense", "negative", "surface"),
  text("Amount", "transfer", "transfer", "surface"),
  text("Amount", "hidden", "inkMuted", "surface"),
  text("Amount", "estimate", "warning", "surface"),

  text("HeroBalance", "label", "onHeroMuted", "hero"),
  text("HeroBalance", "value", "onHero", "hero"),
  text("HeroBalance", "freshness", "onHeroMuted", "hero"),
  ui("HeroBalance", "toggle", "onHero", "hero"),
  ui("HeroBalance", "action-icon", "onHero", "heroDeco"),
  text("HeroBalance", "action-label", "onHero", "hero"),

  text("StatTile", "label-neutral", "ink", "surface"),
  text("StatTile", "note-neutral", "inkMuted", "surface"),
  ui("StatTile", "border-neutral", "borderStrong", "surface"),
  ui("StatTile", "spent-icon", "catOrange", "surface"),
  text("StatTile", "spent-label", "ink", "catOrangeSoft"),
  ui("StatTile", "income-icon", "catGreen", "surface"),
  text("StatTile", "income-label", "ink", "catGreenSoft"),
  ui("StatTile", "transfer-icon", "transfer", "surface"),
  text("StatTile", "transfer-label", "ink", "transferSoft"),

  text("SummaryCard", "label", "inkMuted", "surface"),
  ui("SummaryCard", "explain", "inkMuted", "surface"),
  text("SummaryCard", "delta-good", "positive", "surface"),
  text("SummaryCard", "delta-bad", "warning", "surface"),
  text("SummaryCard", "freshness", "inkMuted", "surface"),

  text("ProgressBar", "label", "ink", "bg"),
  text("ProgressBar", "percent", "inkMuted", "bg"),
  ui("ProgressBar", "track-primary", "primary", "surfaceAlt"),
  ui("ProgressBar", "track-positive", "positive", "surfaceAlt"),
  ui("ProgressBar", "track-warning", "warning", "surfaceAlt"),
  ui("ProgressBar", "track-danger", "danger", "surfaceAlt"),
  text("ProgressBar", "used", "inkMuted", "bg"),
  text("ProgressBar", "over", "danger", "bg"),
  text("ProgressBar", "warn-left", "warning", "bg"),

  text("ProgressRing", "percent", "ink", "bg"),
  ui("ProgressRing", "track-primary", "primary", "surfaceAlt"),
  ui("ProgressRing", "track-warning", "warning", "surfaceAlt"),
  ui("ProgressRing", "track-danger", "danger", "surfaceAlt"),

  text("BudgetTile", "category", "ink", "surface"),
  text("BudgetTile", "left", "inkMuted", "surface"),
  text("BudgetTile", "warn", "warning", "surface"),
  text("BudgetTile", "over", "danger", "surface"),
  ui("BudgetTile", "border", "borderStrong", "surface"),
  text("BudgetTile", "row-category", "ink", "surfaceAlt"),
  text("BudgetTile", "row-left", "inkMuted", "surfaceAlt"),

  text("TransactionRow", "title", "ink", "surface"),
  text("TransactionRow", "meta", "inkMuted", "surface"),
  hairline("TransactionRow", "divider", "border", "surface"),

  text("TransactionDetail", "title", "ink", "surface"),
  text("TransactionDetail", "fact-key", "inkMuted", "surfaceAlt"),
  text("TransactionDetail", "fact-value", "ink", "surfaceAlt"),
  hairline("TransactionDetail", "fact-divider", "border", "surfaceAlt"),

  text("CategoryBreakdown", "label", "ink", "bg"),
  text("CategoryBreakdown", "caption", "inkMuted", "bg"),
  ui("CategoryBreakdown", "fill", "primary", "surfaceAlt"),
  hairline("CategoryBreakdown", "divider", "border", "bg"),

  text("BarChart", "title", "ink", "bg"),
  text("BarChart", "axis", "inkMuted", "bg"),
  text("BarChart", "label", "inkMuted", "bg"),
  text("BarChart", "highlight", "ink", "bg"),
  text("BarChart", "legend", "inkMuted", "bg"),
  ui("BarChart", "series1", "chart1", "bg"),
  ui("BarChart", "series2", "chart2", "bg"),
  hairline("BarChart", "grid", "border", "bg"),

  text("LineChart", "title", "ink", "bg"),
  text("LineChart", "axis", "inkMuted", "bg"),
  text("LineChart", "legend", "inkMuted", "bg"),
  ui("LineChart", "series1", "chart1", "bg"),
  ui("LineChart", "series2", "chart2", "bg"),
  ui("LineChart", "series3", "chart3", "bg"),
  hairline("LineChart", "grid", "border", "bg"),

  text("DataTable", "header", "inkMuted", "surfaceAlt"),
  ui("DataTable", "sort-icon", "inkMuted", "surfaceAlt"),
  text("DataTable", "cell", "ink", "surface"),
  text("DataTable", "empty", "inkMuted", "surface"),
  ui("DataTable", "border", "borderStrong", "surface"),
  hairline("DataTable", "row-divider", "border", "surface"),

  text("BottomNav", "active-label", "ink", "surface"),
  text("BottomNav", "idle-label", "inkMuted", "surface"),
  ui("BottomNav", "active-icon", "onPrimarySoft", "primarySoft"),
  ui("BottomNav", "idle-icon", "inkMuted", "surface"),
  ui("BottomNav", "add", "onPrimary", "primary"),
  ui("BottomNav", "add-ring", "bg", "primary"),
  ui("BottomNav", "border", "borderStrong", "surface"),

  text("NavRail", "active-label", "ink", "surface"),
  text("NavRail", "idle-label", "inkMuted", "surface"),
  ui("NavRail", "active-icon", "onPrimarySoft", "primarySoft"),
  ui("NavRail", "idle-icon", "inkMuted", "surface"),
  ui("NavRail", "fab", "onPrimary", "primary"),
  ui("NavRail", "border", "borderStrong", "surface"),

  text("Sidebar", "active", "onPrimarySoft", "primarySoft"),
  text("Sidebar", "idle", "ink", "surface"),
  ui("Sidebar", "active-icon", "onPrimarySoft", "primarySoft"),
  ui("Sidebar", "idle-icon", "inkMuted", "surface"),
  text("Sidebar", "workspace-label", "inkMuted", "surface"),
  text("Sidebar", "workspace-name", "ink", "surface"),
  ui("Sidebar", "workspace-border", "borderStrong", "surface"),
  ui("Sidebar", "border", "borderStrong", "surface"),
];
