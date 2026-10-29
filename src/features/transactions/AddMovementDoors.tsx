import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { AmountInput, Button, InlineError, Select, Sheet, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { OpenDebtSheet } from '@/features/debts/OpenDebtSheet';
import { DebtsPaymentSheet } from '@/features/debts/DebtsPaymentSheet';
import { debtRows, findRecentPayment } from '@/features/debts/helpers';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

const sp = tokens.spacing;

export type MovementDoor = 'lend' | 'debtPayment' | 'allocate' | 'spend' | 'investment';

export function AddMovementDoorSheet({ door, onClose }: { door: MovementDoor; onClose: () => void }) {
  const { snapshot } = useWorkspace();
  if (!snapshot) return null;
  if (door === 'lend') return <LendBorrowSheet snapshot={snapshot} onClose={onClose} />;
  if (door === 'debtPayment') return <DebtPaymentSheet snapshot={snapshot} onClose={onClose} />;
  if (door === 'allocate') return <AllocateGoalSheet snapshot={snapshot} onClose={onClose} />;
  if (door === 'spend') return <SpendGoalSheet snapshot={snapshot} onClose={onClose} />;
  return <InvestmentDoorSheet onClose={onClose} />;
}

/** PU-34 from Add More ▾ — full OpenDebtSheet, not a thin stub. */
function LendBorrowSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();

  return (
    <OpenDebtSheet
      direction="owedToMe"
      snapshot={snapshot}
      onClose={onClose}
      onSave={async (input) => {
        const r = await repo.openPersonDebt(input);
        if (!r.ok) {
          toast.show(ledgerMessage(r.error));
          return;
        }
        toast.show(t('debts.loanRecorded'));
        onClose();
      }}
    />
  );
}

function DebtPaymentSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const openDebts = debtRows(snapshot, 'all', today()).filter((r) => r.debt.status === 'open');
  const [debtId, setDebtId] = useState(openDebts[0]?.debt.id ?? '');
  const [picking, setPicking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const row = openDebts.find((r) => r.debt.id === debtId) ?? null;

  if (!picking && row) {
    return (
      <DebtsPaymentSheet
        debt={row.debt}
        max={row.balance}
        snapshot={snapshot}
        onClose={onClose}
        onSave={async (input) => {
          setError(null);
          const dup = findRecentPayment(row.debt.id, snapshot, input.principal, input.date);
          if (dup && !input.force) {
            setError(t('debts.duplicateBody', { date: input.date }));
            return;
          }
          const r = await repo.recordDebtPayment(row.debt.id, {
            accountId: input.accountId,
            amount: input.principal,
            date: input.date,
            interest: input.interest,
            overpayment: input.overpayment,
          });
          if (!r.ok) setError(ledgerMessage(r.error));
          else {
            toast.show(t('debts.paymentRecorded'));
            onClose();
          }
        }}
      />
    );
  }

  return (
    <Sheet
      visible
      testID="add-door-payment"
      title={t('add.door.paymentTitle')}
      onClose={onClose}
      footer={
        <Button
          label={t('common.continue')}
          disabled={!debtId}
          onPress={() => setPicking(false)}
        />
      }
    >
      {openDebts.length === 0 ? (
        <Text>{t('add.door.noDebts')}</Text>
      ) : (
        <Select
          testID="add-door-debt"
          label={t('debts.title')}
          options={openDebts.map((r) => ({ value: r.debt.id, label: r.debt.name }))}
          value={debtId}
          onChange={setDebtId}
        />
      )}
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

function AllocateGoalSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const active = snapshot.goals.filter((g) => g.status === 'active');
  const [goalId, setGoalId] = useState(active[0]?.id ?? '');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!goalId || amountMinor === null) return;
    const r = await repo.allocateToGoal(goalId, { amount: amountMinor, date: today() });
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      toast.show(t('add.movementSaved'));
      onClose();
    }
  };

  return (
    <Sheet visible testID="add-door-allocate" title={t('add.door.allocateTitle')} onClose={onClose} footer={<Button label={t('add.save')} disabled={!goalId || amountMinor === null} onPress={() => void save()} />}>
      {active.length === 0 ? (
        <Text>{t('add.door.noGoals')}</Text>
      ) : (
        <>
          <Select label={t('goals.title')} options={active.map((g) => ({ value: g.id, label: g.name }))} value={goalId} onChange={setGoalId} />
          <AmountInput label={t('add.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
        </>
      )}
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

function SpendGoalSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const active = snapshot.goals.filter((g) => g.status === 'active');
  const [goalId, setGoalId] = useState(active[0]?.id ?? '');
  const [accountId, setAccountId] = useState(snapshot.accounts.find((a) => !a.archived)?.id ?? '');
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));

  const save = async () => {
    if (!goalId || amountMinor === null) return;
    const r = await repo.spendFromGoal(goalId, { accountId, categoryId, amount: amountMinor, date: today() });
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      toast.show(t('add.movementSaved'));
      onClose();
    }
  };

  return (
    <Sheet visible testID="add-door-spend" title={t('add.door.spendTitle')} onClose={onClose} footer={<Button label={t('add.save')} disabled={!goalId || amountMinor === null} onPress={() => void save()} />}>
      {active.length === 0 ? (
        <Text>{t('add.door.noGoals')}</Text>
      ) : (
        <View style={{ gap: sp['spacing-sm'] }}>
          <Select label={t('goals.title')} options={active.map((g) => ({ value: g.id, label: g.name }))} value={goalId} onChange={setGoalId} />
          <Select label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
          <Select label={t('add.category')} options={categories} value={categoryId} onChange={setCategoryId} />
          <AmountInput label={t('add.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
        </View>
      )}
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

function InvestmentDoorSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <Sheet
      visible
      testID="add-door-investment"
      title={t('add.door.investmentTitle')}
      onClose={onClose}
      footer={
        <Button
          label={t('add.door.openInvestments')}
          onPress={() => {
            onClose();
            router.push('/investments');
          }}
        />
      }
    >
      <Text tone="textSecondary">{t('add.door.investmentBody')}</Text>
      <Button
        kind="secondary"
        label={t('investments.buy')}
        onPress={() => {
          onClose();
          router.push('/investments?trade=buy');
        }}
      />
      <Button
        kind="secondary"
        label={t('investments.dividend')}
        onPress={() => {
          onClose();
          router.push('/investments?dividend=1');
        }}
      />
    </Sheet>
  );
}
