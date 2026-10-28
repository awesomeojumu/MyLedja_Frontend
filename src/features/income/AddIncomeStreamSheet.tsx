import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  Amount,
  AmountInput,
  Button,
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

import { takeHomeMinor, TAX_CLASS_PRESETS } from './helpers';

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
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<IncomeStreamKind>(existing?.kind ?? 'regular');
  const [amountKind, setAmountKind] = useState<IncomeAmountKind>(existing?.amountKind ?? 'exact');
  const [countInBudget, setCountInBudget] = useState(existing?.countInBudget ?? true);
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

  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'income').map((c) => ({ value: c.id, label: c.name }));
  const goals = snapshot.goals.map((g) => ({ value: g.id, label: g.name }));
  const expenseCategories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));

  const draftStream = useMemo((): IncomeStreamInput | null => {
    if (amountMinor === null || amountMinor <= 0n || !name.trim() || !accountId || !categoryId) return null;
    return {
      name: name.trim(),
      kind,
      expectedMinor: amountMinor.toString(),
      accountId,
      categoryId,
      rule: { every, on: Math.min(31, Math.max(1, Number(onDay) || 1)) },
      countInBudget: kind === 'passive' ? countInBudget : true,
      taxClass,
      amountKind,
      rangeMinMinor: amountKind === 'range' && rangeMinMinor ? rangeMinMinor.toString() : undefined,
      rangeMaxMinor: amountKind === 'range' && rangeMaxMinor ? rangeMaxMinor.toString() : undefined,
      recordMode,
      grossMinor: recordMode === 'gross' && grossMinor ? grossMinor.toString() : undefined,
      deductions: recordMode === 'gross' ? deductions : undefined,
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
    taxClass,
  ]);

  const takeHome = draftStream
    ? takeHomeMinor({ ...draftStream, id: 'draft' })
    : null;

  const canSave = draftStream !== null;

  return (
    <Sheet
      visible
      title={existing ? t('income.editStreamTitle') : t('income.addStreamTitle')}
      onClose={onClose}
      testID="income-add-sheet"
      footer={
        <Button
          testID="income-save"
          label={t('panel.save')}
          disabled={!canSave}
          onPress={() => void onSave(draftStream!)}
        />
      }
    >
      <Section title={t('income.sectionBasics')}>
        <TextInput testID="income-name" label={t('income.name')} value={name} onChangeText={setName} />
        <Select
          testID="income-kind"
          label={t('income.kind')}
          options={kinds.map((k) => ({ value: k, label: t(`income.kind.${k}`) }))}
          value={kind}
          onChange={(v) => setKind(v as IncomeStreamKind)}
        />
        <Select
          testID="income-amount-kind"
          label={t('income.amountKind')}
          options={amountKinds.map((k) => ({ value: k, label: t(`income.amountKind.${k}`) }))}
          value={amountKind}
          onChange={(v) => setAmountKind(v as IncomeAmountKind)}
        />
        <AmountInput
          testID="income-amount"
          label={amountKind === 'range' ? t('income.expectedMid') : t('income.expectedAmount')}
          value={amountText}
          onChange={(text, minor) => {
            setAmountText(text);
            setAmountMinor(minor);
          }}
        />
        {amountKind === 'range' ? (
          <>
            <AmountInput testID="income-range-min" label={t('income.rangeMin')} value={rangeMinText} onChange={(text, minor) => { setRangeMinText(text); setRangeMinMinor(minor); }} />
            <AmountInput testID="income-range-max" label={t('income.rangeMax')} value={rangeMaxText} onChange={(text, minor) => { setRangeMaxText(text); setRangeMaxMinor(minor); }} />
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
          onChange={(v) => setEvery(v as RecurrenceEvery)}
        />
        <TextInput testID="income-schedule-on" label={every === 'week' ? t('income.weekday') : t('plan.dayOfMonth')} value={onDay} onChangeText={setOnDay} keyboardType="number-pad" />
        <Select testID="income-account" label={t('income.account')} options={accounts} value={accountId} onChange={setAccountId} />
        <Select testID="income-category" label={t('income.category')} options={categories} value={categoryId} onChange={setCategoryId} />
        <Select
          testID="income-tax-class"
          label={t('income.taxClass')}
          options={TAX_CLASS_PRESETS.map((p) => ({ value: p, label: p }))}
          value={taxClass}
          onChange={setTaxClass}
        />
        <Select
          testID="income-reminder"
          label={t('income.reminder')}
          options={reminders.map((r) => ({ value: r, label: t(`income.reminder.${r}`) }))}
          value={reminder}
          onChange={(v) => setReminder(v as IncomeReminder)}
        />
      </Section>

      <Section title={t('income.sectionRecord')}>
        <Select
          testID="income-record-mode"
          label={t('income.recordAs')}
          options={recordModes.map((m) => ({ value: m, label: t(`income.recordMode.${m}`) }))}
          value={recordMode}
          onChange={(v) => setRecordMode(v as IncomeRecordMode)}
        />
        {recordMode === 'gross' ? (
          <>
            <AmountInput testID="income-gross" label={t('income.grossAmount')} value={grossText} onChange={(text, minor) => { setGrossText(text); setGrossMinor(minor); }} />
            {deductions.map((row, i) => (
              <DeductionRow
                key={i}
                row={row}
                accounts={accounts}
                categories={categories}
                onChange={(next) => setDeductions((rows) => rows.map((r, j) => (j === i ? next : r)))}
                onRemove={() => setDeductions((rows) => rows.filter((_, j) => j !== i))}
              />
            ))}
            <Button testID="income-add-deduction" kind="secondary" size="sm" label={t('income.addDeduction')} onPress={() => setDeductions((rows) => [...rows, { kind: 'paye' }])} />
            {takeHome !== null ? (
              <Text tone="textSecondary">
                {t('income.takeHomeLine')}: <Amount minor={takeHome} variant="caption" />
              </Text>
            ) : null}
          </>
        ) : null}
        <Switch testID="income-count-budget" label={t('income.countInBudget')} value={countInBudget} onChange={setCountInBudget} />
      </Section>

      <Section title={t('income.sectionRouting')}>
        {routing.map((row, i) => (
          <RoutingRow
            key={i}
            row={row}
            goals={goals}
            categories={expenseCategories}
            onChange={(next) => setRouting((rows) => rows.map((r, j) => (j === i ? next : r)))}
            onRemove={() => setRouting((rows) => rows.filter((_, j) => j !== i))}
          />
        ))}
        <Button testID="income-add-routing" kind="secondary" size="sm" label={t('income.addRouting')} onPress={() => setRouting((rows) => [...rows, {}])} />
      </Section>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
      <Text variant="heading-sm">{title}</Text>
      {children}
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
  const [amountText, setAmountText] = useState(row.amountMinor ?? '');
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
  if (row.restToBudget) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('income.routingRest')}</Text>
        <Button kind="link" size="sm" label={t('income.removeRow')} onPress={onRemove} />
      </View>
    );
  }
  const [amountText, setAmountText] = useState(row.amountMinor ?? '');
  const [pct, setPct] = useState(row.percent !== undefined ? String(row.percent) : '');
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
