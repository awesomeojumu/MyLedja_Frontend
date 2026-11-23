import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { v7 as uuidv7 } from 'uuid';
import { Plus, Trash2, Wallet, Receipt, LifeBuoy, PiggyBank, TrendingUp, Banknote } from 'lucide-react-native';
import { useTheme, Button } from '../../../design';
import { t } from '../../../i18n';
import { formatNaira } from '../../../money';
import type { AccountKind, AccountPurpose } from '../../../data/workspace/model';
import { AddAccountSheet } from '../../accounts/AddAccountSheet';
import { PURPOSE_INFO } from '../../accounts/purpose';
import { toMinor } from '../plan';
import { Card, Chip, ChipRow, Hint, IconButton, SectionLabel, StepHeading, styles, type StepProps } from '../ui';

type Quick = { purpose: AccountPurpose; label: string; icon: React.ReactNode; kind?: AccountKind; name?: string };

export function MoneyStep({ draft, update }: StepProps) {
  const { colors, typography, spacing } = useTheme();
  const [sheet, setSheet] = useState<Quick | null>(null);

  const quick: Quick[] = [
    { purpose: 'operating', label: t('wiz.money.quick.operating'), icon: <Wallet size={15} color={colors.primary} /> },
    { purpose: 'bills', label: t('wiz.money.quick.bills'), icon: <Receipt size={15} color={colors.primary} /> },
    { purpose: 'emergency', label: t('wiz.money.quick.emergency'), icon: <LifeBuoy size={15} color={colors.primary} /> },
    { purpose: 'savings', label: t('wiz.money.quick.savings'), icon: <PiggyBank size={15} color={colors.primary} /> },
    { purpose: 'investment', label: t('wiz.money.quick.investment'), icon: <TrendingUp size={15} color={colors.primary} /> },
    { purpose: 'operating', kind: 'cash', name: t('wiz.money.cashName'), label: t('wiz.money.quick.cash'), icon: <Banknote size={15} color={colors.primary} /> },
  ];
  const total = draft.accounts.reduce((s, a) => s + toMinor(a.balance), 0n);

  return (
    <View>
      <StepHeading title={t('wiz.money.title')} body={t('wiz.money.body')} />

      {draft.accounts.length === 0 ? (
        <Hint style={{ marginBottom: spacing.md }}>{t('wiz.money.empty')}</Hint>
      ) : (
        <>
          {draft.accounts.map((a) => (
            <Card key={a.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>{a.name}</Text>
                  <Hint>
                    {PURPOSE_INFO[a.purpose].label}
                    {' · '}
                    {formatNaira(toMinor(a.balance))}
                  </Hint>
                </View>
                <IconButton
                  label={t('wiz.remove')}
                  onPress={() =>
                    update((d) => ({
                      accounts: d.accounts.filter((x) => x.id !== a.id),
                      bills: d.bills.map((b) => (b.accountId === a.id ? { ...b, accountId: '' } : b)),
                      goals: d.goals.map((g) => (g.accountId === a.id ? { ...g, accountId: '' } : g)),
                    }))
                  }
                >
                  <Trash2 size={16} color={colors.statusDanger} />
                </IconButton>
              </View>
            </Card>
          ))}
          <Hint style={{ marginBottom: spacing.md }}>{t('wiz.money.total', { amount: formatNaira(total) })}</Hint>
        </>
      )}

      <Button
        label={t('wiz.money.add')}
        onPress={() => setSheet({ purpose: 'operating', label: '', icon: null })}
        variant="secondary"
        size="md"
        icon={<Plus size={16} color={colors.primary} />}
      />

      <SectionLabel>{t('wiz.money.quick')}</SectionLabel>
      <ChipRow>
        {quick.map((q) => (
          <Chip key={q.label} label={q.label} icon={q.icon} onPress={() => setSheet(q)} />
        ))}
      </ChipRow>

      <AddAccountSheet
        visible={sheet !== null}
        initialPurpose={sheet?.purpose ?? 'operating'}
        initialName={sheet?.name}
        kind={sheet?.kind}
        onClose={() => setSheet(null)}
        onSaveAccount={(acc) =>
          update((d) => ({
            accounts: [
              ...d.accounts,
              {
                id: uuidv7(),
                name: acc.name,
                institution: acc.institution,
                purpose: acc.purpose,
                type: acc.type,
                balance: acc.balanceMinor.toString(),
              },
            ],
          }))
        }
      />
    </View>
  );
}
