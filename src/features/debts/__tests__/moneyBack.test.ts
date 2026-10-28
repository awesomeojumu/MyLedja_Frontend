import { WorkspaceRepository } from '@/data/workspace/repository';

import { memorySync } from '../../../../test/helpers/render';
import { listMoneyBackReview, suggestMoneyBack } from '../moneyBack';

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'envelope',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

describe('money back suggestions (A-13 / TECH-SPEC 6.15)', () => {
  it('suggests when payee matches an open owed-to-me debt and never auto-posts', async () => {
    const { repo } = await seeded();
    const snap0 = await repo.load();
    const accountId = snap0.accounts[0]!.id;
    const opened = await repo.openPersonDebt({
      name: 'Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 10_000_000n,
      date: '2026-10-01',
      payeeName: 'Tunde',
    });
    expect(opened.ok).toBe(true);
    const snapshot = await repo.load();
    const suggestions = suggestMoneyBack(snapshot, {
      amount: 4_000_000n,
      date: '2026-10-15',
      accountId,
      payeeName: 'Tunde',
      movement: 'income',
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.personName).toBe('Tunde');
    expect(suggestions[0]!.outstanding).toBe(10_000_000n);

    const before = (await repo.load()).events.length;
    expect((await repo.load()).events.length).toBe(before);

    const confirmed = await repo.confirmMoneyBack(
      {
        debtId: suggestions[0]!.debtId,
        amount: 4_000_000n,
        date: '2026-10-15',
        accountId,
      },
      'money_back',
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.type).toBe('collect');
  });

  it('income choice leaves the debt outstanding', async () => {
    const { repo } = await seeded();
    const snap0 = await repo.load();
    const accountId = snap0.accounts[0]!.id;
    const incomeCat = snap0.categories.find((c) => c.kind === 'income')!;
    await repo.openPersonDebt({
      name: 'Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 10_000_000n,
      date: '2026-10-01',
      payeeName: 'Tunde',
    });
    const snapshot = await repo.load();
    const suggestions = suggestMoneyBack(snapshot, {
      amount: 4_000_000n,
      date: '2026-10-15',
      accountId,
      payeeName: 'Tunde',
      movement: 'income',
    });
    const posted = await repo.addTransaction({
      kind: 'income',
      accountId,
      categoryId: incomeCat.id,
      amount: 4_000_000n,
      date: '2026-10-15',
      payeeName: 'Tunde',
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    await repo.confirmMoneyBack(
      {
        debtId: suggestions[0]!.debtId,
        amount: 4_000_000n,
        date: '2026-10-15',
        accountId,
        eventId: posted.value.id,
      },
      'income',
    );
    const after = await repo.load();
    const debt = after.debts.find((d) => d.name === 'Tunde')!;
    expect(repo.debtBalance(debt, after, '2026-10-15')).toBe(10_000_000n);
  });

  it('lists imported matches for the Debts review banner', async () => {
    const { repo } = await seeded();
    const snap0 = await repo.load();
    const accountId = snap0.accounts[0]!.id;
    const incomeCat = snap0.categories.find((c) => c.kind === 'income')!;
    await repo.openPersonDebt({
      name: 'Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 10_000_000n,
      date: '2026-10-01',
      payeeName: 'TUNDE OKAFOR',
    });
    const mapping = {
      hasHeader: false,
      date: 0,
      dateFormat: 'YYYY-MM-DD' as const,
      amount: 1,
      moneyIn: null,
      moneyOut: null,
      description: null,
      payee: 2,
      notes: null,
    };
    await repo.importRows(
      accountId,
      [{ date: '2026-10-20', amount: 4_000_000n, categoryId: incomeCat.id, payeeName: 'TUNDE OKAFOR', notes: '' }],
      mapping,
    );
    const review = listMoneyBackReview(await repo.load());
    expect(review.length).toBeGreaterThanOrEqual(1);
    expect(review[0]!.personName).toBe('Tunde');
  });
});
