import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { v7 as uuidv7 } from 'uuid';
import { LifeBuoy, PiggyBank, Plus, Trash2, TrendingUp } from 'lucide-react-native';
import { useTheme, TextInput, Dropdown, Button, DatePicker } from '../../../design';
import { t } from '../../../i18n';
import { formatNaira } from '../../../money';
import type { AccountPurpose } from '../../../data/workspace/model';
import { AddAccountSheet } from '../../accounts/AddAccountSheet';
import { goalMonthly, monthlyEssentials, summarize, toMinor, type DraftGoal, type GoalKind, type SetupDraft } from '../plan';
import { Card, Chip, ChipRow, Hint, IconButton, MoneyField, SectionLabel, StepHeading, styles, type StepProps } from '../ui';

const SAVING_PURPOSES: AccountPurpose[] = ['emergency', 'savings', 'project'];

/** Accounts a goal of this kind can be kept in. */
function homesFor(draft: SetupDraft, kind: GoalKind) {
  const wanted = kind === 'investment' ? (['investment'] as AccountPurpose[]) : SAVING_PURPOSES;
  return draft.accounts.filter((a) => wanted.includes(a.purpose));
}

function bestHome(draft: SetupDraft, kind: GoalKind) {
  const homes = homesFor(draft, kind);
  return (kind === 'emergency' ? homes.find((a) => a.purpose === 'emergency') : undefined) ?? homes[0];
}

export function GoalsStep({ draft, update }: StepProps) {
  const { colors, typography, spacing } = useTheme();
  const [months, setMonths] = useState(6);
  const [sheet, setSheet] = useState<{ purpose: AccountPurpose; forGoal: string } | null>(null);

  const essentials = monthlyEssentials(draft);
  const suggestion = essentials * BigInt(months);
  const summary = summarize(draft);
  const emergency = draft.goals.find((g) => g.kind === 'emergency');

  const addGoal = (kind: GoalKind, patch: Partial<DraftGoal> = {}) =>
    update((x) => ({
      goals: [
        ...x.goals,
        {
          id: uuidv7(),
          kind,
          name: kind === 'emergency' ? t('wiz.goals.emergency') : '',
          target: '',
          date: '',
          saved: '',
          accountId: bestHome(x, kind)?.id ?? '',
          ...patch,
        },
      ],
    }));

  const setGoal = (id: string, patch: Partial<DraftGoal>) =>
    update((x) => ({ goals: x.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));

  return (
    <View>
      <StepHeading title={t('wiz.goals.title')} body={t('wiz.goals.body')} />

      <Card>
        <View style={styles.row}>
          <LifeBuoy size={18} color={colors.primary} />
          <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.body, marginLeft: spacing.sm }}>
            {t('wiz.goals.emergency')}
          </Text>
        </View>
        <Hint style={{ marginTop: 4 }}>{t('wiz.goals.emergencyBody')}</Hint>
        <View style={{ marginTop: spacing.sm }}>
          <ChipRow>
            {[3, 6, 12].map((n) => (
              <Chip key={n} label={t('wiz.goals.months', { n })} selected={months === n} onPress={() => setMonths(n)} />
            ))}
          </ChipRow>
        </View>
        {essentials > 0n && (
          <View style={[styles.row, { marginTop: spacing.sm, gap: spacing.sm }]}>
            <Hint style={{ flex: 1 }}>{t('wiz.goals.suggest', { amount: formatNaira(suggestion), months })}</Hint>
            <Button
              label={t('wiz.goals.useSuggestion')}
              size="sm"
              variant="secondary"
              onPress={() =>
                emergency ? setGoal(emergency.id, { target: suggestion.toString() }) : addGoal('emergency', { target: suggestion.toString() })
              }
            />
          </View>
        )}
      </Card>

      {draft.goals.map((g, i) => {
        const homes = homesFor(draft, g.kind);
        const monthly = goalMonthly(g);
        return (
          <Card key={g.id} style={{ zIndex: 100 - i }}>
            <View style={[styles.row, { gap: spacing.sm }]}>
              {g.kind === 'investment' ? (
                <TrendingUp size={18} color={colors.primary} />
              ) : g.kind === 'emergency' ? (
                <LifeBuoy size={18} color={colors.primary} />
              ) : (
                <PiggyBank size={18} color={colors.primary} />
              )}
              <View style={{ flex: 1 }}>
                <TextInput
                  label={t('wiz.goals.name')}
                  placeholder={g.kind === 'investment' ? t('wiz.goals.investPlaceholder') : t('wiz.goals.namePlaceholder')}
                  value={g.name}
                  onChangeText={(name) => setGoal(g.id, { name })}
                />
              </View>
              <IconButton label={t('wiz.remove')} onPress={() => update((x) => ({ goals: x.goals.filter((k) => k.id !== g.id) }))}>
                <Trash2 size={16} color={colors.statusDanger} />
              </IconButton>
            </View>
            <View style={[styles.row, { gap: spacing.md, marginTop: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <MoneyField label={t('wiz.goals.target')} value={g.target} onChange={(target) => setGoal(g.id, { target })} />
              </View>
              <View style={{ flex: 1 }}>
                <MoneyField label={t('wiz.goals.saved')} value={g.saved} onChange={(saved) => setGoal(g.id, { saved })} />
              </View>
            </View>
            <View style={{ marginTop: spacing.sm, zIndex: 3 }}>
              <DatePicker label={t('wiz.goals.date')} value={g.date} onChange={(date) => setGoal(g.id, { date })} />
            </View>
            <View style={{ marginTop: spacing.sm, zIndex: 2 }}>
              {homes.length > 0 ? (
                <Dropdown
                  label={t('wiz.goals.keepIn')}
                  value={g.accountId}
                  options={homes.map((a) => ({ label: a.name, value: a.id }))}
                  onSelect={(accountId) => setGoal(g.id, { accountId })}
                />
              ) : (
                <View style={[styles.row, { gap: spacing.sm }]}>
                  <Hint style={{ flex: 1 }} tone="danger">
                    {t('wiz.goals.noAccount')}
                  </Hint>
                  <Button
                    label={t('wiz.money.add')}
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      setSheet({ purpose: g.kind === 'investment' ? 'investment' : g.kind === 'emergency' ? 'emergency' : 'savings', forGoal: g.id })
                    }
                  />
                </View>
              )}
            </View>
            {monthly > 0n && <Hint style={{ marginTop: spacing.sm }}>{t('wiz.goals.monthly', { amount: formatNaira(monthly) })}</Hint>}
          </Card>
        );
      })}

      <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs }]}>
        {!emergency && (
          <Button label={t('wiz.goals.emergency')} size="sm" variant="secondary" icon={<Plus size={14} color={colors.primary} />} onPress={() => addGoal('emergency')} />
        )}
        <Button label={t('wiz.goals.addSavings')} size="sm" variant="secondary" icon={<Plus size={14} color={colors.primary} />} onPress={() => addGoal('savings')} />
        <Button
          label={t('wiz.goals.addInvestment')}
          size="sm"
          variant="secondary"
          icon={<Plus size={14} color={colors.primary} />}
          onPress={() => addGoal('investment')}
        />
      </View>

      {toMinor(draft.takeHome) > 0n && draft.goals.length > 0 && (
        <>
          <SectionLabel>{t('wiz.review.goals')}</SectionLabel>
          <Hint tone={summary.goalsMonthly > summary.savingCapacity ? 'danger' : 'muted'}>
            {t('wiz.goals.capacity', { need: formatNaira(summary.goalsMonthly), have: formatNaira(summary.savingCapacity) })}
          </Hint>
        </>
      )}

      <AddAccountSheet
        visible={sheet !== null}
        initialPurpose={sheet?.purpose ?? 'savings'}
        onClose={() => setSheet(null)}
        onSaveAccount={(acc) => {
          const id = uuidv7();
          const goalId = sheet?.forGoal;
          update((x) => ({
            accounts: [
              ...x.accounts,
              { id, name: acc.name, institution: acc.institution, purpose: acc.purpose, type: acc.type, balance: acc.balanceMinor.toString() },
            ],
            goals: x.goals.map((g) => (g.id === goalId ? { ...g, accountId: id } : g)),
          }));
        }}
      />
    </View>
  );
}
