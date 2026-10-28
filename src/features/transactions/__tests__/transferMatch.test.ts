import { WorkspaceRepository } from '@/data/workspace/repository';

import { memorySync } from '../../../../test/helpers/render';
import { pairKey, transferMatchCandidates } from '../transferMatch';

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' },
      { name: 'OPay', type: 'wallet', openingBalance: '0', openingDate: '2026-10-01' },
    ],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

describe('transferMatch (P11-09)', () => {
  it('suggests opposite legs with the same amount within 3 days', async () => {
    const { repo } = await seeded();
    const s0 = await repo.load();
    const bank = s0.accounts.find((a) => a.name === 'GTBank')!;
    const wallet = s0.accounts.find((a) => a.name === 'OPay')!;
    const market = s0.categories.find((c) => c.name === 'Market')!;
    const income = s0.categories.find((c) => c.kind === 'income')!;

    const out = await repo.addTransaction({
      kind: 'expense',
      accountId: bank.id,
      parts: [{ categoryId: market.id, amount: 5_000_000n }],
      date: '2026-10-20',
      payeeName: 'Move out',
    });
    const inn = await repo.addTransaction({
      kind: 'income',
      accountId: wallet.id,
      categoryId: income.id,
      amount: 5_000_000n,
      date: '2026-10-21',
      payeeName: 'Move in',
    });
    expect(out.ok && inn.ok).toBe(true);
    const snapshot = await repo.load();
    const pairs = transferMatchCandidates(snapshot);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.amount).toBe(5_000_000n);
    expect(pairs[0]!.daysApart).toBe(1);
  });

  it('links opposite legs as one transfer and dismisses suggestions', async () => {
    const { repo } = await seeded();
    const s0 = await repo.load();
    const bank = s0.accounts.find((a) => a.name === 'GTBank')!;
    const wallet = s0.accounts.find((a) => a.name === 'OPay')!;
    const market = s0.categories.find((c) => c.name === 'Market')!;
    const income = s0.categories.find((c) => c.kind === 'income')!;

    const out = await repo.addTransaction({
      kind: 'expense',
      accountId: bank.id,
      parts: [{ categoryId: market.id, amount: 2_000_000n }],
      date: '2026-10-22',
    });
    const inn = await repo.addTransaction({
      kind: 'income',
      accountId: wallet.id,
      categoryId: income.id,
      amount: 2_000_000n,
      date: '2026-10-22',
    });
    if (!out.ok || !inn.ok) throw new Error('seed failed');

    const linked = await repo.linkAsTransfer(out.value.id, inn.value.id);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.value.type).toBe('transfer');
    const after = await repo.load();
    expect(after.events.find((e) => e.id === out.value.id)?.status).toBe('reversed');
    expect(after.events.find((e) => e.id === inn.value.id)?.status).toBe('reversed');
    expect(transferMatchCandidates(after)).toHaveLength(0);

    const out2 = await repo.addTransaction({
      kind: 'expense',
      accountId: bank.id,
      parts: [{ categoryId: market.id, amount: 1_000_000n }],
      date: '2026-10-23',
    });
    const in2 = await repo.addTransaction({
      kind: 'income',
      accountId: wallet.id,
      categoryId: income.id,
      amount: 1_000_000n,
      date: '2026-10-23',
    });
    if (!out2.ok || !in2.ok) throw new Error('seed2 failed');
    await repo.dismissTransferMatch(out2.value.id, in2.value.id);
    const dismissed = await repo.transferDismissals();
    expect(dismissed.has(pairKey(out2.value.id, in2.value.id))).toBe(true);
    expect(transferMatchCandidates(await repo.load(), dismissed)).toHaveLength(0);
  });
});
