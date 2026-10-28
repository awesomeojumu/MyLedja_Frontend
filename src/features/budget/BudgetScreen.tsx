import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import {
  Amount,
  AmountInput,
  Banner,
  Button,
  Card,
  EmptyState,
  InlineError,
  Placeholder,
  Popover,
  Select,
  SegmentedControl,
  Sheet,
  Text,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { catalogue, t, type TextKey } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf } from '@/ledger';

import {
  barFor,
  budgetCategories,
  budgetForMonth,
  groupedBudgetCategories,
  monthLabel,
  nextMonth,
  overspentCategories,
  prevMonth,
  rowFor,
  sixMonthAverage,
  threeMonthAverage,
  assignedOf,
  shortMonth,
  type BudgetGroupBy,
} from './helpers';
import { TemplatesSheet } from './TemplatesSheet';

function groupLabel(group: string): string {
  if (group in catalogue) return t(group as TextKey);
  if (group === 'fixed' || group === 'flexible' || group === 'nonMonthly' || group === 'savings') {
    return t(`budget.type.${group}` as TextKey);
  }
  return group;
}

const sp = tokens.spacing;
const c = tokens.color;

function barFill(state: ReturnType<typeof barFor>) {
  if (state === 'over') return c.ruby;
  if (state === 'near') return c.primary;
  return c['primary-soft'];
}

export function BudgetScreen() {
  const { snapshot, repo } = useWorkspace();
  const theme = useTheme();
  const toast = useToast();
  const router = useRouter();
  const [month, setMonth] = useState(() => monthOf(today()));
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editMinor, setEditMinor] = useState<bigint | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [monthSpan, setMonthSpan] = useState<'1' | '3'>('1');
  const [groupBy, setGroupBy] = useState<BudgetGroupBy>('groups');
  const [error, setError] = useState<string | null>(null);

  const displayMonths = useMemo(() => {
    if (monthSpan === '1') return [month];
    return [prevMonth(prevMonth(month)), prevMonth(month), month];
  }, [month, monthSpan]);

  const model = useMemo(() => {
    if (!snapshot) return null;
    const cats = budgetCategories(snapshot);
    const budget = budgetForMonth(snapshot, month);
    const groups = groupedBudgetCategories(snapshot, groupBy);
    return {
      cats,
      budget,
      groups,
      overspent: overspentCategories(snapshot, month),
      style: snapshot.settings.budgetStyle,
      income: budget.leftToPlan,
    };
  }, [snapshot, month, groupBy]);

  const savePlanned = async () => {
    if (!editId || editMinor === null || editMinor < 0n) return;
    setError(null);
    await repo.setAssigned(editId, month, editMinor);
    toast.show(t('common.saved'));
    setEditId(null);
  };

  return (
    <AppFrame title={t('budget.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp['spacing-md'] }}>
          <Pressable
            testID="budget-prev-month"
            accessibilityRole="button"
            accessibilityLabel={t('date.previousMonth')}
            onPress={() => setMonth(prevMonth(month))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={20} color={theme.textSecondary} />
          </Pressable>
          <Text testID="budget-month" variant="heading-sm" accessibilityRole="header">
            {monthLabel(month)}
          </Text>
          <Pressable
            testID="budget-next-month"
            accessibilityRole="button"
            accessibilityLabel={t('date.nextMonth')}
            onPress={() => setMonth(nextMonth(month))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center' }}>
          <SegmentedControl
            testID="budget-month-span"
            label={t('budget.monthSpan')}
            value={monthSpan}
            onChange={setMonthSpan}
            options={[
              { value: '1', label: t('budget.oneMonth') },
              { value: '3', label: t('budget.threeMonths') },
            ]}
          />
          <Select
            testID="budget-group-by"
            label={t('budget.groupBy')}
            value={groupBy}
            onChange={(v) => setGroupBy(v as BudgetGroupBy)}
            options={[
              { value: 'groups', label: t('budget.groupGroups') },
              { value: 'type', label: t('budget.groupType') },
            ]}
          />
          <Button testID="budget-more-menu" kind="secondary" label={t('budget.moreMenu')} onPress={() => setMenuOpen(true)} />
        </View>

        {!model ? (
          <Placeholder height={120} />
        ) : model.cats.length === 0 ? (
          <EmptyState title={t('budget.emptyTitle')} body={t('budget.emptyBody')} actionLabel={t('budget.emptyAction')} onAction={() => router.push('/')} />
        ) : (
          <>
            <BudgetBanner
              style={model.style}
              leftToPlan={model.budget.leftToPlan}
              overspentCount={model.overspent.length}
              onCover={() => setCoverOpen(true)}
            />
            <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
              <Button testID="budget-move" kind="secondary" label={t('budget.moveMoney')} onPress={() => setMoveOpen(true)} />
              {snapshot && snapshot.assigns.size > 0 ? (
                <Button testID="budget-templates" kind="secondary" label={t('budget.templates')} onPress={() => setTemplatesOpen(true)} />
              ) : null}
              {model.overspent.length > 0 ? (
                <Button
                  testID="budget-cover"
                  kind="secondary"
                  label={t('budget.coverOverspending', { count: model.overspent.length })}
                  onPress={() => setCoverOpen(true)}
                />
              ) : null}
            </View>
            {error ? <InlineError message={error} /> : null}
            {monthSpan === '3' ? (
              <View testID="budget-three-months" style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
                {displayMonths.map((m) => (
                  <Text key={m} variant="caption" tone={m === month ? undefined : 'textSecondary'}>
                    {shortMonth(m)}
                  </Text>
                ))}
              </View>
            ) : null}
            <View testID="budget-columns" style={{ flexDirection: 'row', gap: sp['spacing-md'], paddingHorizontal: sp['spacing-md'] }}>
              <Text variant="caption" tone="textSecondary" style={{ flex: 1 }}>
                {t('budget.col.category')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 88, textAlign: 'right' }}>
                {t('budget.col.planned')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 88, textAlign: 'right' }}>
                {t('budget.col.spent')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 88, textAlign: 'right' }}>
                {t('budget.col.remaining')}
              </Text>
            </View>
            {model.groups.map(([group, cats]) => (
              <Card key={group} testID={`budget-group-${group}`} style={{ padding: 0, gap: 0 }}>
                <View style={{ padding: sp['spacing-md'] }}>
                  <Text variant="heading-sm">{groupLabel(group)}</Text>
                </View>
                {cats.map((cat) => {
                  const row = rowFor(snapshot!, month, cat.id);
                  const state = barFor(snapshot!, month, cat.id);
                  const plan = row.carried + row.assigned;
                  const pct = plan <= 0n ? (row.activity > 0n ? 1 : 0) : Number((row.activity * 1000n) / plan) / 1000;
                  return (
                    <View
                      key={cat.id}
                      testID={`budget-row-${cat.id}`}
                      style={{
                        paddingHorizontal: sp['spacing-md'],
                        paddingVertical: sp['spacing-sm'],
                        borderTopWidth: 1,
                        borderTopColor: theme.border,
                        gap: sp['spacing-xs'],
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'] }}>
                        <Pressable
                          testID={`budget-name-${cat.id}`}
                          accessibilityRole="link"
                          accessibilityLabel={cat.name}
                          onPress={() => router.push(`/budget/category/${cat.id}`)}
                          style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
                        >
                          <Text>{cat.name}</Text>
                        </Pressable>
                        <Pressable
                          testID={`budget-planned-${cat.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={t('budget.editPlanned', { name: cat.name })}
                          onPress={() => {
                            setEditId(cat.id);
                            setEditText((Number(row.assigned) / 100).toString());
                            setEditMinor(row.assigned);
                          }}
                          style={{ width: 88, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
                        >
                          <Amount minor={row.assigned} />
                        </Pressable>
                        {monthSpan === '3'
                          ? displayMonths
                              .filter((m) => m !== month)
                              .map((m) => (
                                <View key={m} style={{ width: 72, alignItems: 'flex-end' }}>
                                  <Amount minor={assignedOf(snapshot!, cat.id, m)} variant="caption" />
                                </View>
                              ))
                          : null}
                        <Pressable
                          testID={`budget-spent-${cat.id}`}
                          accessibilityRole="link"
                          accessibilityLabel={t('budget.spentLink', { name: cat.name })}
                          onPress={() => router.push({ pathname: '/transactions', params: { category: cat.id, month } })}
                          style={{ width: 88, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
                        >
                          <Amount minor={row.activity} />
                        </Pressable>
                        <View style={{ width: 88, alignItems: 'flex-end' }} testID={`budget-remaining-${cat.id}`}>
                          <Amount minor={row.available} />
                          {state === 'near' ? (
                            <Text variant="micro" tone="textSecondary">
                              {t('budget.nearLimit')}
                            </Text>
                          ) : null}
                          {state === 'over' ? (
                            <Text variant="micro" style={{ color: theme.error }}>
                              {t('budget.overBy', { amount: formatNaira(-row.available) })}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View
                        testID={`budget-bar-${cat.id}`}
                        accessibilityRole="progressbar"
                        accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(pct * 100)) }}
                        style={{ height: 3, width: '90%', backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' }}
                      >
                        <View style={{ height: 3, width: `${Math.min(100, pct * 100)}%`, backgroundColor: barFill(state) }} />
                      </View>
                    </View>
                  );
                })}
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      <Sheet
        visible={editId !== null}
        title={
          editId && snapshot
            ? t('budget.editAmount', { name: snapshot.categories.find((c) => c.id === editId)?.name ?? '' })
            : t('budget.editAmount', { name: '' })
        }
        onClose={() => setEditId(null)}
        testID="budget-edit-sheet"
        footer={
          <Button testID="budget-edit-save" label={t('budget.save')} onPress={() => void savePlanned()} disabled={editMinor === null || editMinor < 0n} />
        }
      >
        <AmountInput label={t('budget.col.planned')} value={editText} onChange={(text, minor) => { setEditText(text); setEditMinor(minor); }} testID="budget-edit-amount" />
        {editId && snapshot ? (
          <View style={{ gap: sp['spacing-xs'] }}>
            <Button
              kind="link"
              label={t('budget.quickLastMonth', { amount: formatNaira(assignedOf(snapshot, editId, prevMonth(month))) })}
              onPress={() => {
                const v = assignedOf(snapshot, editId, prevMonth(month));
                setEditMinor(v);
                setEditText((Number(v) / 100).toString());
              }}
            />
            <Button
              kind="link"
              label={t('budget.quickThreeMonthAvg', { amount: formatNaira(threeMonthAverage(snapshot, editId, month)) })}
              onPress={() => {
                const v = threeMonthAverage(snapshot, editId, month);
                setEditMinor(v);
                setEditText((Number(v) / 100).toString());
              }}
            />
          </View>
        ) : null}
      </Sheet>

      <Popover visible={menuOpen} onClose={() => setMenuOpen(false)} testID="budget-menu-popover">
        <Text variant="heading-sm">{t('budget.moreMenu')}</Text>
        <Button
          testID="budget-menu-copy"
          kind="secondary"
          label={t('budget.menuCopyLast')}
          onPress={() => void repo.copyBudgetMonth(prevMonth(month), month).then(() => { toast.show(t('common.saved')); setMenuOpen(false); })}
        />
        <Button
          testID="budget-menu-averages"
          kind="secondary"
          label={t('budget.menuFillAverages')}
          onPress={() => void repo.fillBudgetFromAverages(month).then(() => { toast.show(t('common.saved')); setMenuOpen(false); })}
        />
        <Button
          testID="budget-menu-templates"
          kind="secondary"
          label={t('budget.menuApplyTemplates')}
          onPress={() => {
            setMenuOpen(false);
            setTemplatesOpen(true);
          }}
        />
        <Button
          testID="budget-menu-zero"
          kind="secondary"
          label={t('budget.menuZero')}
          onPress={() => void repo.clearMonthBudget(month).then(() => { toast.show(t('common.saved')); setMenuOpen(false); })}
        />
      </Popover>

      {snapshot && moveOpen ? (
        <MoveMoneySheet
          month={month}
          snapshot={snapshot}
          onClose={() => setMoveOpen(false)}
          onSave={async (fromId, toId, amount) => {
            const r = await repo.moveAssigned(fromId, toId, month, amount);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('budget.moved'));
            setMoveOpen(false);
          }}
        />
      ) : null}

      {snapshot && coverOpen ? (
        <CoverSheet
          month={month}
          snapshot={snapshot}
          onClose={() => setCoverOpen(false)}
          onSave={async (covers) => {
            const r = await repo.coverOverspending(month, covers);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('budget.covered'));
            setCoverOpen(false);
          }}
        />
      ) : null}

      <TemplatesSheet visible={templatesOpen} month={month} onClose={() => setTemplatesOpen(false)} />
    </AppFrame>
  );
}

function BudgetBanner({
  style,
  leftToPlan,
  overspentCount,
  onCover,
}: {
  style: 'tracking' | 'envelope';
  leftToPlan: bigint;
  overspentCount: number;
  onCover: () => void;
}) {
  if (style === 'tracking') {
    return <Banner testID="budget-banner" message={t('budget.trackingBanner')} />;
  }
  const over = leftToPlan < 0n;
  return (
    <View
      testID="budget-banner"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: sp['spacing-md'],
        flexWrap: 'wrap',
        backgroundColor: tokens.color['primary-bg-subdued-hover'],
        borderRadius: tokens.radius['rounded-md'],
        padding: sp['spacing-md'],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], flexShrink: 1 }}>
        {over ? <View testID="budget-over-dot" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.ruby }} /> : null}
        <Text>
          {over
            ? t('budget.plannedMore', { amount: formatNaira(-leftToPlan) })
            : t('budget.leftToPlan', { amount: formatNaira(leftToPlan) })}
        </Text>
      </View>
      {overspentCount > 0 ? (
        <Button testID="budget-banner-cover" kind="secondary" label={t('budget.coverOverspending', { count: overspentCount })} onPress={onCover} />
      ) : null}
    </View>
  );
}

function MoveMoneySheet({
  month,
  snapshot,
  onClose,
  onSave,
}: {
  month: string;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (fromId: string, toId: string, amount: bigint) => Promise<void>;
}) {
  const cats = budgetCategories(snapshot);
  const [fromId, setFromId] = useState(cats[0]?.id ?? '');
  const [toId, setToId] = useState(cats[1]?.id ?? cats[0]?.id ?? '');
  const [text, setText] = useState('');
  const [minor, setMinor] = useState<bigint | null>(null);
  const fromRow = fromId ? rowFor(snapshot, month, fromId) : null;
  const toRow = toId ? rowFor(snapshot, month, toId) : null;
  const options = cats.map((c) => ({ value: c.id, label: c.name }));
  const previewFrom = fromRow && minor !== null ? fromRow.assigned - minor : null;
  const previewTo = toRow && minor !== null ? toRow.assigned + minor : null;

  return (
    <Sheet
      visible
      title={t('budget.moveMoney')}
      onClose={onClose}
      testID="budget-move-sheet"
      footer={
        <Button
          testID="budget-move-save"
          label={t('budget.moveSave')}
          disabled={!fromId || !toId || fromId === toId || minor === null || minor <= 0n}
          onPress={() => void onSave(fromId, toId, minor!)}
        />
      }
    >
      <Select testID="budget-move-from" label={t('budget.moveFrom')} options={options} value={fromId} onChange={setFromId} />
      {fromRow ? (
        <Text variant="caption" tone="textSecondary">
          {t('budget.moveRemaining', { amount: formatNaira(fromRow.available) })}
        </Text>
      ) : null}
      <Select testID="budget-move-to" label={t('budget.moveTo')} options={options.filter((o) => o.value !== fromId)} value={toId} onChange={setToId} />
      <AmountInput label={t('budget.moveAmount')} value={text} onChange={(v, m) => { setText(v); setMinor(m); }} testID="budget-move-amount" />
      {previewFrom !== null && previewTo !== null ? (
        <View testID="budget-move-preview" style={{ gap: sp['spacing-xs'] }}>
          <Text variant="caption">{t('budget.movePreviewFrom', { amount: formatNaira(previewFrom) })}</Text>
          <Text variant="caption">{t('budget.movePreviewTo', { amount: formatNaira(previewTo) })}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

function CoverSheet({
  month,
  snapshot,
  onClose,
  onSave,
}: {
  month: string;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (covers: { overspentId: string; fromId: string; amount: bigint }[]) => Promise<void>;
}) {
  const overspent = overspentCategories(snapshot, month);
  const sources = budgetCategories(snapshot).filter((c) => !overspent.some((o) => o.category.id === c.id));
  const [fromBy, setFromBy] = useState<Record<string, string>>(() =>
    Object.fromEntries(overspent.map((o) => [o.category.id, sources[0]?.id ?? ''])),
  );

  return (
    <Sheet
      visible
      title={t('budget.coverTitle')}
      onClose={onClose}
      testID="budget-cover-sheet"
      footer={
        <Button
          testID="budget-cover-save"
          label={t('budget.coverAll')}
          disabled={overspent.length === 0 || overspent.some((o) => !fromBy[o.category.id])}
          onPress={() =>
            void onSave(
              overspent.map((o) => ({
                overspentId: o.category.id,
                fromId: fromBy[o.category.id]!,
                amount: o.over,
              })),
            )
          }
        />
      }
    >
      {overspent.length === 0 ? (
        <Text tone="textSecondary">{t('budget.coverNone')}</Text>
      ) : (
        overspent.map((o) => (
          <View key={o.category.id} testID={`cover-row-${o.category.id}`} style={{ gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
            <Text>
              {t('budget.coverRow', { name: o.category.name, amount: formatNaira(o.over) })}
            </Text>
            <Select
              testID={`cover-from-${o.category.id}`}
              label={t('budget.coverFrom')}
              options={sources.map((s) => ({ value: s.id, label: s.name }))}
              value={fromBy[o.category.id] ?? ''}
              onChange={(v) => setFromBy((prev) => ({ ...prev, [o.category.id]: v }))}
            />
          </View>
        ))
      )}
    </Sheet>
  );
}
