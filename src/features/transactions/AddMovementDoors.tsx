import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { AmountInput, Button, InlineError, Select, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
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

function LendBorrowSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'owedToMe' | 'iOwe'>('owedToMe');
  const [accountId, setAccountId] = useState(snapshot.accounts.find((a) => !a.archived)?.id ?? '');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));

  const save = async () => {
    if (amountMinor === null || !accountId) return;
    setError(null);
    const r = await repo.openPersonDebt({ name, direction, accountId, amount: amountMinor, date: today(), payeeName: name });
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      toast.show(t('add.movementSaved'));
      onClose();
    }
  };

  return (
    <Sheet visible testID="add-door-lend" title={t('add.door.lendTitle')} onClose={onClose} footer={<Button testID="add-door-lend-save" label={t('add.save')} disabled={amountMinor === null || amountMinor <= 0n} onPress={() => void save()} />}>
      <Text tone="textSecondary">{t('add.door.lendBody')}</Text>
      <TextInput testID="add-door-name" label={t('debts.personName')} value={name} onChangeText={setName} />
      <Select
        testID="add-door-direction"
        label={t('debts.direction')}
        options={[
          { value: 'owedToMe', label: t('debts.theyOwe') },
          { value: 'iOwe', label: t('debts.iOwe') },
        ]}
        value={direction}
        onChange={(v) => setDirection(v as 'owedToMe' | 'iOwe')}
      />
      <Select testID="add-door-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <AmountInput testID="add-door-amount" label={t('add.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

function DebtPaymentSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const openDebts = snapshot.debts.filter((d) => d.status === 'open');
  const [debtId, setDebtId] = useState(openDebts[0]?.id ?? '');
  const [accountId, setAccountId] = useState(snapshot.accounts.find((a) => !a.archived)?.id ?? '');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));

  const save = async () => {
    if (!debtId || amountMinor === null) return;
    const r = await repo.recordDebtPayment(debtId, { accountId, amount: amountMinor, date: today() });
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      toast.show(t('add.movementSaved'));
      onClose();
    }
  };

  return (
    <Sheet visible testID="add-door-payment" title={t('add.door.paymentTitle')} onClose={onClose} footer={<Button label={t('add.save')} disabled={!debtId || amountMinor === null} onPress={() => void save()} />}>
      {openDebts.length === 0 ? (
        <Text>{t('add.door.noDebts')}</Text>
      ) : (
        <>
          <Select testID="add-door-debt" label={t('debts.title')} options={openDebts.map((d) => ({ value: d.id, label: d.name }))} value={debtId} onChange={setDebtId} />
          <Select label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
          <AmountInput label={t('add.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
        </>
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
    <Sheet visible testID="add-door-investment" title={t('add.door.investmentTitle')} onClose={onClose} footer={<Button label={t('add.door.openAccounts')} onPress={() => { onClose(); router.push('/accounts'); }} />}>
      <Text tone="textSecondary">{t('add.door.investmentBody')}</Text>
    </Sheet>
  );
}
