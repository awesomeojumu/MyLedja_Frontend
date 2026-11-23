import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, Plus, Search, Square, CheckSquare, Trash2 } from 'lucide-react-native';
import { useTheme, TextInput, Dropdown, Button } from '../../../design';
import { t } from '../../../i18n';
import { formatNaira } from '../../../money';
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, type CategoryDefinition } from '../../../data/categoriesTaxonomy';
import { SAVE_OR_INVEST_TAXONOMY_ID } from '../../categories/catalog';
import { frameworkOf, isSpendingPillar, lineAmounts, pillarAmounts, planLines, toMinor } from '../plan';
import { Card, Chip, ChipRow, Hint, IconButton, MoneyField, SectionLabel, StepHeading, styles, type StepProps } from '../ui';

type Tab = 'expense' | 'income';

const SPENDING = EXPENSE_TAXONOMY.filter((d) => d.id !== SAVE_OR_INVEST_TAXONOMY_ID);

export function CategoriesStep({ draft, update }: StepProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [tab, setTab] = useState<Tab>('expense');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [ownName, setOwnName] = useState('');

  const fw = frameworkOf(draft);
  const spendingPillars = fw.pillars.filter(isSpendingPillar);
  const lines = planLines(draft, fw);
  const amounts = lineAmounts(draft, fw);
  const targets = pillarAmounts(fw, toMinor(draft.takeHome));
  const hasIncome = toMinor(draft.takeHome) > 0n;

  const q = query.trim().toLowerCase();
  const matches = (d: CategoryDefinition) =>
    !q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.subcategories.some((s) => s.toLowerCase().includes(q));

  const subsOf = (d: CategoryDefinition) => draft.subcategories[d.id] ?? d.subcategories;
  const setSubs = (d: CategoryDefinition, subs: string[]) => update((x) => ({ subcategories: { ...x.subcategories, [d.id]: subs } }));

  const toggleCategory = (d: CategoryDefinition, kind: Tab) =>
    update((x) => {
      const list = kind === 'income' ? x.incomeIds : x.expenseIds;
      const on = list.includes(d.id);
      const next = on ? list.filter((i) => i !== d.id) : [...list, d.id];
      if (kind === 'income' && next.length === 0) return {};
      return kind === 'income' ? { incomeIds: next } : { expenseIds: next };
    });

  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pillarOptions = spendingPillars.map((p) => ({ label: `${p.name} (${p.percentage}%)`, value: p.id }));

  const renderCard = (d: CategoryDefinition, kind: Tab) => {
    const on = (kind === 'income' ? draft.incomeIds : draft.expenseIds).includes(d.id);
    const expanded = open.has(d.id) || (!!q && on);
    const subs = subsOf(d);
    const line = lines.find((l) => l.key === d.id);
    const amount = amounts.get(d.id) ?? 0n;
    return (
      <Card key={d.id} selected={on}>
        <View style={styles.row}>
          <IconButton label={d.name} onPress={() => toggleCategory(d, kind)}>
            {on ? <CheckSquare size={20} color={colors.primary} /> : <Square size={20} color={colors.textTertiary} />}
          </IconButton>
          <TouchableOpacity style={{ flex: 1, marginLeft: spacing.xs }} onPress={() => (on ? toggleOpen(d.id) : toggleCategory(d, kind))}>
            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.body }}>{d.name}</Text>
            <Hint>{on ? t('wiz.cat.subCount', { on: subs.length, all: d.subcategories.length }) : d.description}</Hint>
          </TouchableOpacity>
          {on && kind === 'expense' && hasIncome && (
            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, marginRight: spacing.xs }}>{formatNaira(amount)}</Text>
          )}
          {on && (
            <IconButton label={d.name} onPress={() => toggleOpen(d.id)}>
              {expanded ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
            </IconButton>
          )}
        </View>

        {on && expanded && (
          <View style={{ marginTop: spacing.sm }}>
            <Hint style={{ marginBottom: spacing.sm }}>{d.description}</Hint>
            <View style={[styles.row, { marginBottom: spacing.sm, gap: spacing.md }]}>
              <TouchableOpacity onPress={() => setSubs(d, [...d.subcategories])}>
                <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.sm }}>{t('wiz.cat.selectAll')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSubs(d, [])}>
                <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.sm }}>{t('wiz.cat.clear')}</Text>
              </TouchableOpacity>
            </View>
            <ChipRow>
              {d.subcategories.map((s) => {
                const subOn = subs.includes(s);
                return (
                  <Chip
                    key={s}
                    label={s}
                    selected={subOn}
                    onPress={() => setSubs(d, subOn ? subs.filter((x) => x !== s) : [...subs, s])}
                  />
                );
              })}
            </ChipRow>
            {kind === 'expense' && line && (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Dropdown
                  label={t('wiz.cat.partOf')}
                  value={line.pillarId}
                  options={pillarOptions}
                  onSelect={(pillarId) =>
                    update((x) => ({ pillarOf: { ...x.pillarOf, [d.id]: pillarId }, amounts: { ...x.amounts, [d.id]: '' } }))
                  }
                />
                {hasIncome && (
                  <MoneyField
                    label={t('wiz.cat.monthly')}
                    placeholder={t('wiz.cat.suggested', { amount: formatNaira(amount) })}
                    value={draft.amounts[d.id] ?? ''}
                    onChange={(m) => update((x) => ({ amounts: { ...x.amounts, [d.id]: m } }))}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </Card>
    );
  };

  const spendingOn = SPENDING.filter((d) => draft.expenseIds.includes(d.id) && matches(d));
  const spendingOff = SPENDING.filter((d) => !draft.expenseIds.includes(d.id) && matches(d));
  const incomeList = INCOME_TAXONOMY.filter(matches);

  const pillarSummary = spendingPillars.map((p) => ({
    pillar: p,
    planned: lines.filter((l) => l.pillarId === p.id).reduce((s, l) => s + (amounts.get(l.key) ?? 0n), 0n),
    target: targets.get(p.id) ?? 0n,
  }));

  return (
    <View>
      <StepHeading title={t('wiz.cat.title')} body={t('wiz.cat.body')} />

      <View style={[styles.row, { gap: spacing.sm, marginBottom: spacing.md }]}>
        {(['expense', 'income'] as Tab[]).map((id) => (
          <TouchableOpacity
            key={id}
            onPress={() => setTab(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: radii.full,
              backgroundColor: tab === id ? colors.primary : colors.surfaceSubtle,
            }}
          >
            <Text style={{ color: tab === id ? '#FFFFFF' : colors.textPrimary, fontFamily: typography.fonts.semiBold }}>
              {id === 'expense' ? t('wiz.cat.spending') : t('wiz.cat.income')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <TextInput
          placeholder={t('wiz.cat.search')}
          value={query}
          onChangeText={setQuery}
          leftElement={<Search size={18} color={colors.textTertiary} />}
        />
      </View>

      {tab === 'expense' ? (
        <>
          {!hasIncome && <Hint style={{ marginBottom: spacing.sm }}>{t('wiz.cat.noIncome')}</Hint>}
          {spendingPillars.map((p) => {
            const row = pillarSummary.find((r) => r.pillar.id === p.id)!;
            const mine = spendingOn.filter((d) => lines.find((l) => l.key === d.id)?.pillarId === p.id);
            const own = draft.customCategories.filter((c) => lines.find((l) => l.key === c.key)?.pillarId === p.id);
            if (mine.length === 0 && own.length === 0 && q) return null;
            return (
              <View key={p.id}>
                <SectionLabel
                  right={
                    hasIncome ? (
                      <Hint tone={row.planned > row.target ? 'danger' : 'muted'}>
                        {t('wiz.cat.pillarPlanned', { planned: formatNaira(row.planned), target: formatNaira(row.target) })}
                      </Hint>
                    ) : undefined
                  }
                >
                  {`${p.name} (${p.percentage}%)`}
                </SectionLabel>
                {mine.map((d) => renderCard(d, 'expense'))}
                {own.map((c) => (
                  <Card key={c.key} selected>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>{c.name}</Text>
                      </View>
                      {hasIncome && (
                        <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, marginRight: spacing.xs }}>
                          {formatNaira(amounts.get(c.key) ?? 0n)}
                        </Text>
                      )}
                      <IconButton
                        label={t('wiz.remove')}
                        onPress={() => update((x) => ({ customCategories: x.customCategories.filter((k) => k.key !== c.key) }))}
                      >
                        <Trash2 size={16} color={colors.statusDanger} />
                      </IconButton>
                    </View>
                    {hasIncome && (
                      <View style={{ marginTop: spacing.sm }}>
                        <MoneyField
                          label={t('wiz.cat.monthly')}
                          value={draft.amounts[c.key] ?? ''}
                          onChange={(m) => update((x) => ({ amounts: { ...x.amounts, [c.key]: m } }))}
                        />
                      </View>
                    )}
                  </Card>
                ))}
              </View>
            );
          })}

          <SectionLabel>{t('wiz.cat.addOwn')}</SectionLabel>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <TextInput placeholder={t('wiz.cat.ownPlaceholder')} value={ownName} onChangeText={setOwnName} accessibilityLabel={t('wiz.cat.ownName')} />
            </View>
            <Button
              label={t('wiz.add')}
              size="sm"
              variant="secondary"
              icon={<Plus size={14} color={colors.primary} />}
              onPress={() => {
                const name = ownName.trim();
                if (!name) return;
                update((x) => ({
                  customCategories: [
                    ...x.customCategories,
                    { key: `custom-${Date.now()}`, name, pillarId: spendingPillars[spendingPillars.length > 1 ? 1 : 0]?.id ?? '' },
                  ],
                }));
                setOwnName('');
              }}
            />
          </View>

          {spendingOff.length > 0 && (
            <>
              <SectionLabel>{t('wiz.cat.more')}</SectionLabel>
              {spendingOff.map((d) => renderCard(d, 'expense'))}
            </>
          )}
          {spendingOn.length === 0 && spendingOff.length === 0 && <Hint>{t('wiz.cat.noMatch')}</Hint>}
          <Hint style={{ marginTop: spacing.md }}>{t('wiz.cat.savingsNote')}</Hint>
        </>
      ) : (
        <>
          {incomeList.map((d) => renderCard(d, 'income'))}
          {incomeList.length === 0 && <Hint>{t('wiz.cat.noMatch')}</Hint>}
        </>
      )}
    </View>
  );
}
