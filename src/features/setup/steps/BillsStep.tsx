import React from 'react';
import { View } from 'react-native';
import { v7 as uuidv7 } from 'uuid';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTheme, TextInput, Dropdown, Button } from '../../../design';
import { t, type TextKey } from '../../../i18n';
import { formatNaira } from '../../../money';
import { EXPENSE_TAXONOMY } from '../../../data/categoriesTaxonomy';
import { catalogEntries, subKey } from '../../categories/catalog';
import { isSpendingAccount } from '../../accounts/purpose';
import { allBills, toMinor, type DebtKind, type DraftBill, type SetupDraft } from '../plan';
import { Card, Chip, ChipRow, Hint, IconButton, MoneyField, NumberField, SectionLabel, StepHeading, styles, type StepProps } from '../ui';

/** Common bills and the subcategory each is filed under. */
const PRESETS: { label: TextKey; sub: string; day: number }[] = [
  { label: 'wiz.bills.preset.rent', sub: 'Rent', day: 1 },
  { label: 'wiz.bills.preset.power', sub: 'Electricity', day: 5 },
  { label: 'wiz.bills.preset.data', sub: 'Data', day: 1 },
  { label: 'wiz.bills.preset.internet', sub: 'Internet', day: 1 },
  { label: 'wiz.bills.preset.streaming', sub: 'Streaming services', day: 15 },
  { label: 'wiz.bills.preset.school', sub: 'School fees', day: 10 },
];

/** The category a subcategory name belongs to, preferring one already switched on. */
function findSub(draft: SetupDraft, sub: string) {
  const owners = EXPENSE_TAXONOMY.filter((d) => d.subcategories.includes(sub));
  return owners.find((d) => draft.expenseIds.includes(d.id)) ?? owners[0];
}

export function BillsStep({ draft, update }: StepProps) {
  const { colors, spacing } = useTheme();
  const payFrom = draft.accounts.filter((a) => isSpendingAccount({ type: a.type, archived: false }));
  const defaultAccount = (draft.accounts.find((a) => a.purpose === 'bills') ?? payFrom[0] ?? draft.accounts[0])?.id ?? '';

  const entries = catalogEntries(draft.expenseIds, draft.incomeIds, draft.subcategories).filter((e) => e.kind === 'expense');
  const categoryOptions = entries.map((e) => ({ label: e.sub ? `${e.group} · ${e.name}` : e.name, value: e.key }));
  const accountOptions = draft.accounts.map((a) => ({ label: a.name, value: a.id }));

  const addBill = (name: string, sub: string | null, day: number) =>
    update((x) => {
      const def = sub ? findSub(x, sub) : undefined;
      // A preset switches its category and subcategory on, so the bill always has somewhere to go.
      const expenseIds = def && !x.expenseIds.includes(def.id) ? [...x.expenseIds, def.id] : x.expenseIds;
      const subs = def ? (x.subcategories[def.id] ?? def.subcategories) : [];
      const subcategories = def && sub && !subs.includes(sub) ? { ...x.subcategories, [def.id]: [...subs, sub] } : x.subcategories;
      const bill: DraftBill = {
        id: uuidv7(),
        name,
        amount: '',
        day,
        categoryKey: def && sub ? subKey(def, sub) : (entries[0]?.key ?? 'exp-miscellaneous'),
        accountId: defaultAccount,
      };
      return { expenseIds, subcategories, bills: [...x.bills, bill] };
    });

  const setBill = (id: string, patch: Partial<DraftBill>) =>
    update((x) => ({ bills: x.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));

  // Bills plus monthly debt repayments: everything fixed that comes out first.
  const billsTotal = allBills(draft).reduce((s, b) => s + b.amount, 0n);
  const kindOptions: { label: string; value: DebtKind }[] = [
    { label: t('wiz.debts.kind.bankLoan'), value: 'bankLoan' },
    { label: t('wiz.debts.kind.iOwe'), value: 'iOwe' },
    { label: t('wiz.debts.kind.owedToMe'), value: 'owedToMe' },
  ];

  return (
    <View>
      <StepHeading title={t('wiz.bills.title')} body={t('wiz.bills.body')} />

      <SectionLabel>{t('wiz.bills.quick')}</SectionLabel>
      <ChipRow>
        {PRESETS.map((p) => (
          <Chip key={p.label} label={t(p.label)} icon={<Plus size={13} color={colors.primary} />} onPress={() => addBill(t(p.label), p.sub, p.day)} />
        ))}
      </ChipRow>

      <View style={{ marginTop: spacing.md }}>
        {draft.bills.length === 0 && <Hint style={{ marginBottom: spacing.sm }}>{t('wiz.bills.none')}</Hint>}
        {draft.bills.map((b, i) => (
          <Card key={b.id} style={{ zIndex: 100 - i }}>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <TextInput label={t('wiz.bills.name')} value={b.name} onChangeText={(name) => setBill(b.id, { name })} />
              </View>
              <IconButton label={t('wiz.remove')} onPress={() => update((x) => ({ bills: x.bills.filter((k) => k.id !== b.id) }))}>
                <Trash2 size={16} color={colors.statusDanger} />
              </IconButton>
            </View>
            <View style={[styles.row, { gap: spacing.md, alignItems: 'flex-end', marginTop: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <MoneyField label={t('wiz.bills.amount')} value={b.amount} onChange={(amount) => setBill(b.id, { amount })} />
              </View>
              <View style={{ marginBottom: 4 }}>
                <Hint style={{ marginBottom: 4 }}>{t('wiz.bills.day')}</Hint>
                <NumberField accessibilityLabel={t('wiz.bills.day')} value={b.day} min={1} max={31} onChange={(day) => setBill(b.id, { day })} />
              </View>
            </View>
            <View style={{ marginTop: spacing.sm, zIndex: 2 }}>
              <Dropdown label={t('wiz.bills.category')} value={b.categoryKey} options={categoryOptions} onSelect={(categoryKey) => setBill(b.id, { categoryKey })} />
            </View>
            {accountOptions.length > 0 && (
              <View style={{ marginTop: spacing.sm, zIndex: 1 }}>
                <Dropdown label={t('wiz.bills.from')} value={b.accountId} options={accountOptions} onSelect={(accountId) => setBill(b.id, { accountId })} />
              </View>
            )}
          </Card>
        ))}
        <Button
          label={t('wiz.bills.addOther')}
          onPress={() => addBill('', null, draft.payday)}
          variant="secondary"
          size="md"
          icon={<Plus size={16} color={colors.primary} />}
        />
        {toMinor(draft.takeHome) > 0n && (
          <Hint style={{ marginTop: spacing.sm }} tone={billsTotal > toMinor(draft.takeHome) ? 'danger' : 'muted'}>
            {t('wiz.bills.total', { amount: formatNaira(billsTotal), income: formatNaira(toMinor(draft.takeHome)) })}
          </Hint>
        )}
      </View>

      <SectionLabel>{t('wiz.debts.title')}</SectionLabel>
      <Hint style={{ marginBottom: spacing.sm }}>{t('wiz.debts.body')}</Hint>
      {draft.debts.map((d, i) => (
        <Card key={d.id} style={{ zIndex: 50 - i }}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <TextInput
                label={t('wiz.debts.name')}
                placeholder={t('wiz.debts.namePlaceholder')}
                value={d.name}
                onChangeText={(name) => update((x) => ({ debts: x.debts.map((k) => (k.id === d.id ? { ...k, name } : k)) }))}
              />
            </View>
            <IconButton label={t('wiz.remove')} onPress={() => update((x) => ({ debts: x.debts.filter((k) => k.id !== d.id) }))}>
              <Trash2 size={16} color={colors.statusDanger} />
            </IconButton>
          </View>
          <View style={{ marginTop: spacing.sm, zIndex: 2 }}>
            <Dropdown
              label={t('wiz.debts.kind')}
              value={d.kind}
              options={kindOptions}
              onSelect={(kind) => update((x) => ({ debts: x.debts.map((k) => (k.id === d.id ? { ...k, kind: kind as DebtKind } : k)) }))}
            />
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <MoneyField
              label={t('wiz.debts.amount')}
              value={d.amount}
              onChange={(amount) => update((x) => ({ debts: x.debts.map((k) => (k.id === d.id ? { ...k, amount } : k)) }))}
            />
          </View>
          {d.kind !== 'owedToMe' && (
            <View style={[styles.row, { gap: spacing.md, alignItems: 'flex-end', marginTop: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <MoneyField
                  label={t('wiz.debts.monthly')}
                  value={d.monthly}
                  onChange={(monthly) => update((x) => ({ debts: x.debts.map((k) => (k.id === d.id ? { ...k, monthly } : k)) }))}
                />
              </View>
              <View style={{ marginBottom: 4 }}>
                <Hint style={{ marginBottom: 4 }}>{t('wiz.bills.day')}</Hint>
                <NumberField
                  accessibilityLabel={t('wiz.bills.day')}
                  value={d.day}
                  min={1}
                  max={31}
                  onChange={(day) => update((x) => ({ debts: x.debts.map((k) => (k.id === d.id ? { ...k, day } : k)) }))}
                />
              </View>
            </View>
          )}
        </Card>
      ))}
      <Button
        label={t('wiz.debts.add')}
        onPress={() =>
          update((x) => ({ debts: [...x.debts, { id: uuidv7(), name: '', kind: 'bankLoan', amount: '', monthly: '', day: x.payday }] }))
        }
        variant="secondary"
        size="md"
        icon={<Plus size={16} color={colors.primary} />}
      />
    </View>
  );
}
