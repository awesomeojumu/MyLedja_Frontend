import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import {
  Amount,
  AmountInput,
  Button,
  Confirm,
  Footer,
  Select,
  Sheet,
  Switch,
  Text,
  TextInput,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import type {
  IncomeAmountKind,
  IncomeDeduction,
  IncomeDeductionKind,
  IncomeRecordMode,
  IncomeReminder,
  IncomeRouting,
  IncomeStream,
  IncomeStreamKind,
  RecurrenceEvery,
} from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { toInputText } from '@/money';

import {
  defaultCountInBudget,
  deductionsExceedGross,
  routingExceedsIncome,
  takeHomeMinor,
  TAX_CLASS_PRESETS,
} from './helpers';

const sp = tokens.spacing;

export type IncomeStreamInput = Omit<IncomeStream, 'id'>;

type Props = {
  snapshot: Snapshot;
  existing?: IncomeStream;
  onClose: () => void;
  onSave: (data: IncomeStreamInput) => Promise<void>;
};

const kinds: IncomeStreamKind[] = ['regular', 'variable', 'irregular', 'passive'];
const amountKinds: IncomeAmountKind[] = ['exact', 'approximate', 'range'];
const recordModes: IncomeRecordMode[] = ['takeHome', 'gross'];
const deductionKinds: IncomeDeductionKind[] = ['paye', 'pension', 'nhf', 'other'];
const reminders: IncomeReminder[] = ['none', 'sameDay', '1', '3', '7'];

export function AddIncomeStreamSheet({ snapshot, existing, onClose, onSave }: Props) {
  const [name, setName] = useState(existing?.name ?? 'Salary');
  const [source, setSource] = useState(existing?.source ?? '');
  const [kind, setKind] = useState<IncomeStreamKind>(existing?.kind ?? 'regular');
  const [amountKind, setAmountKind] = useState<IncomeAmountKind>(existing?.amountKind ?? 'exact');
  const [countInBudget, setCountInBudget] = useState(existing?.countInBudget ?? defaultCountInBudget(existing?.kind ?? 'regular'));
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(existing ? BigInt(existing.expectedMinor) : null);
  const [rangeMinText, setRangeMinText] = useState('');
  const [rangeMinMinor, setRangeMinMinor] = useState<bigint | null>(existing?.rangeMinMinor ? BigInt(existing.rangeMinMinor) : null);
  const [rangeMaxText, setRangeMaxText] = useState('');
  const [rangeMaxMinor, setRangeMaxMinor] = useState<bigint | null>(existing?.rangeMaxMinor ? BigInt(existing.rangeMaxMinor) : null);
  const [accountId, setAccountId] = useState(existing?.accountId ?? snapshot.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? snapshot.categories.find((c) => c.kind === 'income')?.id ?? '');
  const [taxClass, setTaxClass] = useState(existing?.taxClass ?? 'PAYE');
  const [every, setEvery] = useState<RecurrenceEvery>(existing?.rule.every ?? 'month');
  const [onDay, setOnDay] = useState(String(existing?.rule.on ?? 1));
  const [recordMode, setRecordMode] = useState<IncomeRecordMode>(existing?.recordMode ?? 'takeHome');
  const [grossText, setGrossText] = useState('');
  const [grossMinor, setGrossMinor] = useState<bigint | null>(existing?.grossMinor ? BigInt(existing.grossMinor) : null);
  const [deductions, setDeductions] = useState<IncomeDeduction[]>(existing?.deductions ?? []);
  const [routing, setRouting] = useState<IncomeRouting[]>(existing?.routing ?? [{ restToBudget: true }]);
  const [reminder, setReminder] = useState<IncomeReminder>(existing?.reminder ?? 'sameDay');
  const [basicsOpen, setBasicsOpen] = useState(true);
  const [recordOpen, setRecordOpen] = useState(false);
  const [routingOpen, setRoutingOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const markDirty = () => setDirty(true);
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'income').map((c) => ({ value: c.id, label: c.name }));
  const goals = snapshot.goals.map((g) => ({ value: g.id, label: g.name }));
  const expenseCategories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));

  const draftStream = useMemo((): IncomeStreamInput | null => {
    if (amountMinor === null || amountMinor <= 0n || !name.trim() || !accountId || !categoryId) return null;
    if (amountKind === 'range' && rangeMinMinor !== null && rangeMaxMinor !== null && rangeMaxMinor <= rangeMinMinor) return null;
    return {
      name: name.trim(),
      source: source.trim() || undefined,
      kind,
      expectedMinor: amountMinor.toString(),
      accountId,
      categoryId,
      rule: { every, on: kind === 'irregular' ? 1 : Math.min(31, Math.max(1, Number(onDay) || 1)) },
      countInBudget,
      taxClass,
      amountKind,
      rangeMinMinor: amountKind === 'range' && rangeMinMinor ? rangeMinMinor.toString() : undefined,
      rangeMaxMinor: amountKind === 'range' && rangeMaxMinor ? rangeMaxMinor.toString() : undefined,
      recordMode: kind === 'regular' ? recordMode : 'takeHome',
      grossMinor: kind === 'regular' && recordMode === 'gross' && grossMinor ? grossMinor.toString() : undefined,
      deductions: kind === 'regular' && recordMode === 'gross' ? deductions : undefined,
      routing: routing.length ? routing : undefined,
      reminder,
    };
  }, [
    accountId,
    amountKind,
    amountMinor,
    categoryId,
    countInBudget,
    deductions,
    every,
    grossMinor,
    kind,
    name,
    onDay,
    rangeMaxMinor,
    rangeMinMinor,
    recordMode,
    reminder,
    routing,
    source,
    taxClass,
  ]);

  const takeHome = draftStream ? takeHomeMinor({ ...draftStream, id: 'draft' }) : null;
  const grossError = draftStream && deductionsExceedGross(draftStream) ? t('income.deductionsOverGross') : null;
  const routingError = draftStream && routingExceedsIncome(draftStream) ? t('income.routingOverIncome') : null;
  const canSave = draftStream !== null && !grossError && !routingError && !saving;

  const requestClose = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  return (
    <>
    <Sheet
      visible
      title={existing ? t('income.editStreamTitle') : t('income.addStreamTitle')}
      onClose={requestClose}
      testID="income-add-sheet"
      footer={
        <Footer>
          <Button testID="income-cancel" kind="secondary" label={t('common.cancel')} onPress={requestClose} />
          <Button
            testID="income-save"
            label={existing ? t('plan.saveChanges') : t('income.addStream')}
            disabled={!canSave}
            onPress={() => {
              if (!draftStream) return;
              setSaving(true);
              void onSave(draftStream).finally(() => setSaving(false));
            }}
          />
        </Footer>
      }
    >
      <FoldSection title={t('income.sectionBasics')} open={basicsOpen} onToggle={() => setBasicsOpen((v) => !v)} testID="income-basics">
        <TextInput testID="income-name" label={t('income.name')} value={name} onChangeText={(v) => { markDirty(); setName(v); }} />
        <TextInput testID="income-source" label={t('income.source')} value={source} onChangeText={(v) => { markDirty(); setSource(v); }} />
        <Select
          testID="income-kind"
          label={t('income.kind')}
          options={kinds.map((k) => ({ value: k, label: t(`income.kind.${k}`) }))}
          value={kind}
          onChange={(v) => {
            markDirty();
            const next = v as IncomeStreamKind;
            setKind(next);
            if (!existing) setCountInBudget(defaultCountInBudget(next));
            if (next === 'passive') setTaxClass('Investment');
            if (next === 'irregular') setTaxClass('Self-employed');
            if (next === 'regular') setTaxClass('PAYE');
          }}
        />
        <Select
          testID="income-amount-kind"
          label={t('income.amountKind')}
          options={amountKinds.map((k) => ({ value: k, label: t(`income.amountKind.${k}`) }))}
          value={amountKind}
          onChange={(v) => {
            markDirty();
            setAmountKind(v as IncomeAmountKind);
          }}
        />
        <AmountInput
          testID="income-amount"
          label={amountKind === 'range' ? t('income.expectedMid') : t('income.expectedAmount')}
          value={amountText}
          onChange={(text, minor) => {
            markDirty();
            setAmountText(text);
            setAmountMinor(minor);
          }}
        />
        {amountKind === 'range' ? (
          <>
            <AmountInput testID="income-range-min" label={t('income.rangeMin')} value={rangeMinText} onChange={(text, minor) => { markDirty(); setRangeMinText(text); setRangeMinMinor(minor); }} />
            <AmountInput testID="income-range-max" label={t('income.rangeMax')} value={rangeMaxText} onChange={(text, minor) => { markDirty(); setRangeMaxText(text); setRangeMaxMinor(minor); }} />
          </>
        ) : null}
        <Select
          testID="income-schedule-every"
          label={t('income.howOften')}
          options={[
            { value: 'month', label: t('income.everyMonth') },
            { value: 'week', label: t('income.everyWeek') },
          ]}
          value={every}
          onChange={(v) => {
            markDirty();
            setEvery(v as RecurrenceEvery);
          }}
        />
        {kind !== 'irregular' ? (
          <TextInput testID="income-schedule-on" label={every === 'week' ? t('income.weekday') : t('plan.dayOfMonth')} value={onDay} onChangeText={(v) => { markDirty(); setOnDay(v); }} keyboardType="number-pad" />
        ) : null}
        <Select testID="income-account" label={t('income.account')} options={accounts} value={accountId} onChange={(v) => { markDirty(); setAccountId(v); }} />
        <Select testID="income-category" label={t('income.category')} options={categories} value={categoryId} onChange={(v) => { markDirty(); setCategoryId(v); }} />
        <Select
          testID="income-tax-class"
          label={t('income.taxClass')}
          options={TAX_CLASS_PRESETS.map((p) => ({ value: p, label: p }))}
          value={taxClass}
          onChange={(v) => {
            markDirty();
            setTaxClass(v);
          }}
        />
        <Select
          testID="income-reminder"
          label={t('income.reminder')}
          options={reminders.map((r) => ({ value: r, label: t(`income.reminder.${r}`) }))}
          value={reminder}
          onChange={(v) => {
            markDirty();
            setReminder(v as IncomeReminder);
          }}
        />
        <Switch
          testID="income-count-budget"
          label={t('income.countInBudget')}
          value={countInBudget}
          onChange={(v) => {
            markDirty();
            setCountInBudget(v);
          }}
        />
        {!countInBudget ? (
          <Text variant="caption" tone="textSecondary" testID="income-count-budget-caption">
            {t('income.countInBudgetOff')}
          </Text>
        ) : null}
      </FoldSection>

      {kind === 'regular' ? (
        <FoldSection title={t('income.sectionRecord')} open={recordOpen} onToggle={() => setRecordOpen((v) => !v)} testID="income-record">
          <Select
            testID="income-record-mode"
            label={t('income.recordAs')}
            options={recordModes.map((m) => ({ value: m, label: t(`income.recordMode.${m}`) }))}
            value={recordMode}
            onChange={(v) => {
              markDirty();
              setRecordMode(v as IncomeRecordMode);
            }}
          />
          {recordMode === 'gross' ? (
            <>
              <AmountInput testID="income-gross" label={t('income.grossAmount')} value={grossText} onChange={(text, minor) => { markDirty(); setGrossText(text); setGrossMinor(minor); }} />
              {deductions.map((row, i) => (
                <DeductionRow
                  key={i}
                  row={row}
                  accounts={accounts}
                  categories={categories}
                  onChange={(next) => {
                    markDirty();
                    setDeductions((rows) => rows.map((r, j) => (j === i ? next : r)));
                  }}
                  onRemove={() => {
                    markDirty();
                    setDeductions((rows) => rows.filter((_, j) => j !== i));
                  }}
                />
              ))}
              <Button testID="income-add-deduction" kind="secondary" size="sm" label={t('income.addDeduction')} onPress={() => { markDirty(); setDeductions((rows) => [...rows, { kind: 'paye' }]); }} />
              {takeHome !== null ? (
                <Text tone="textSecondary" testID="income-take-home">
                  {t('income.takeHomeLine')}: <Amount minor={takeHome} variant="caption" />
                </Text>
              ) : null}
              {grossError ? (
                <Text variant="caption" accessibilityRole="alert" testID="income-gross-error">
                  {grossError}
                </Text>
              ) : null}
            </>
          ) : null}
        </FoldSection>
      ) : null}

      <FoldSection title={t('income.sectionRouting')} open={routingOpen} onToggle={() => setRoutingOpen((v) => !v)} testID="income-routing">
        {routing.map((row, i) => (
          <RoutingRow
            key={i}
            row={row}
            goals={goals}
            categories={expenseCategories}
            onChange={(next) => {
              markDirty();
              setRouting((rows) => rows.map((r, j) => (j === i ? next : r)));
            }}
            onRemove={() => {
              markDirty();
              setRouting((rows) => rows.filter((_, j) => j !== i));
            }}
          />
        ))}
        <Button testID="income-add-routing" kind="secondary" size="sm" label={t('income.addRouting')} onPress={() => { markDirty(); setRouting((rows) => [...rows, {}]); }} />
        {routingError ? (
          <Text variant="caption" accessibilityRole="alert" testID="income-routing-error">
            {routingError}
          </Text>
        ) : null}
      </FoldSection>
    </Sheet>
    <Confirm
      visible={discardOpen}
      title={t('common.discardTitle')}
      body={t('common.discardBody')}
      confirmLabel={t('common.discardConfirm')}
      onCancel={() => setDiscardOpen(false)}
      onConfirm={() => {
        setDiscardOpen(false);
        onClose();
      }}
    />
    </>
  );
}

function FoldSection({
  title,
  open,
  onToggle,
  children,
  testID,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={{ gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }} testID={testID}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text variant="heading-sm">
          {open ? '▾ ' : '▸ '}
          {title}
        </Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

function DeductionRow({
  row,
  accounts,
  categories,
  onChange,
  onRemove,
}: {
  row: IncomeDeduction;
  accounts: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  onChange: (row: IncomeDeduction) => void;
  onRemove: () => void;
}) {
  const [amountText, setAmountText] = useState(row.amountMinor ? toInputText(BigInt(row.amountMinor)) : '');
  const [pct, setPct] = useState(row.percent !== undefined ? String(row.percent) : '');
  return (
    <View style={{ gap: sp['spacing-xs'], borderWidth: 1, borderColor: tokens.color.hairline, borderRadius: tokens.radius['rounded-sm'], padding: sp['spacing-sm'] }}>
      <Select
        label={t('income.deductionKind')}
        options={deductionKinds.map((k) => ({ value: k, label: t(`income.deduction.${k}`) }))}
        value={row.kind}
        onChange={(v) => onChange({ ...row, kind: v as IncomeDeductionKind })}
      />
      <AmountInput label={t('income.deductionAmount')} value={amountText} onChange={(text, minor) => { setAmountText(text); onChange({ ...row, amountMinor: minor !== null ? minor.toString() : undefined, percent: undefined }); }} />
      <TextInput label={t('income.deductionPercent')} value={pct} onChangeText={(text) => { setPct(text); onChange({ ...row, percent: Number(text) || undefined, amountMinor: undefined }); }} keyboardType="decimal-pad" />
      {row.kind === 'pension' || row.kind === 'nhf' ? (
        <Select label={t('income.deductionAccount')} options={accounts} value={row.targetAccountId ?? ''} onChange={(v) => onChange({ ...row, targetAccountId: v })} />
      ) : null}
      {row.kind === 'other' ? (
        <Select label={t('income.deductionCategory')} options={categories} value={row.targetCategoryId ?? ''} onChange={(v) => onChange({ ...row, targetCategoryId: v })} />
      ) : null}
      <Button kind="link" size="sm" label={t('income.removeRow')} onPress={onRemove} />
    </View>
  );
}

function RoutingRow({
  row,
  goals,
  categories,
  onChange,
  onRemove,
}: {
  row: IncomeRouting;
  goals: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  onChange: (row: IncomeRouting) => void;
  onRemove: () => void;
}) {
  const [amountText, setAmountText] = useState(row.amountMinor ? toInputText(BigInt(row.amountMinor)) : '');
  const [pct, setPct] = useState(row.percent !== undefined ? String(row.percent) : '');
  if (row.restToBudget) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('income.routingRest')}</Text>
        <Button kind="link" size="sm" label={t('income.removeRow')} onPress={onRemove} />
      </View>
    );
  }
  return (
    <View style={{ gap: sp['spacing-xs'], borderWidth: 1, borderColor: tokens.color.hairline, borderRadius: tokens.radius['rounded-sm'], padding: sp['spacing-sm'] }}>
      <Select label={t('income.routingGoal')} options={[{ value: '', label: t('income.routingNone') }, ...goals]} value={row.goalId ?? ''} onChange={(v) => onChange({ ...row, goalId: v || undefined, categoryId: undefined })} />
      <Select label={t('income.routingCategory')} options={[{ value: '', label: t('income.routingNone') }, ...categories]} value={row.categoryId ?? ''} onChange={(v) => onChange({ ...row, categoryId: v || undefined, goalId: undefined })} />
      <AmountInput label={t('income.routingFixed')} value={amountText} onChange={(text, minor) => { setAmountText(text); onChange({ ...row, amountMinor: minor !== null ? minor.toString() : undefined, percent: undefined }); }} />
      <TextInput label={t('income.routingPercent')} value={pct} onChangeText={(text) => { setPct(text); onChange({ ...row, percent: Number(text) || undefined, amountMinor: undefined }); }} keyboardType="decimal-pad" />
      <Button kind="link" size="sm" label={t('income.removeRow')} onPress={onRemove} />
    </View>
  );
}
