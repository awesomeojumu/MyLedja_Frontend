import { WorkspaceRepository } from '@/data/workspace/repository';

import { memorySync } from '../../../../test/helpers/render';

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Market' },
      { key: 'cat.transport', group: 'group.transport', name: 'Transport' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const accountId = s.accounts[0]!.id;
  const marketId = s.categories.find((c) => c.name === 'Market')!.id;
  const transportId = s.categories.find((c) => c.name === 'Transport')!.id;
  const posted = await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 5_000_000n }],
    date: '2026-10-12',
    payeeName: 'Bolt',
  });
  if (!posted.ok) throw new Error('seed txn');
  const rule = await repo.createRule({
    enabled: true,
    stage: 'normal',
    matchMode: 'all',
    conditions: [{ field: 'payee', op: 'contains', value: 'Bolt' }],
    actions: [{ kind: 'setCategory', value: transportId }],
  });
  return { repo, eventId: posted.value.id, ruleId: rule.id, transportId, marketId };
}

describe('rule run undo (P25-03 / PU48-3)', () => {
  it('preview count equals changes and undo restores category', async () => {
    const { repo, eventId, ruleId, transportId, marketId } = await seeded();
    const before = await repo.load();
    const accountIds = new Set(before.accounts.map((a) => a.id));
    const catBefore = before.events.find((e) => e.id === eventId)!.lines.find((l) => !accountIds.has(l.ledgerAccountId))!.ledgerAccountId;
    expect(catBefore).toBe(marketId);

    const ran = await repo.runRule(ruleId, {});
    expect(ran.ok).toBe(true);
    if (!ran.ok) return;
    expect(ran.value.changed).toBe(1);
    expect(ran.value.undoId).toBeTruthy();

    const mid = await repo.load();
    const replacement = mid.events.find((e) => e.correctionOf === eventId && e.status === 'posted');
    expect(replacement).toBeTruthy();
    const catMid = replacement!.lines.find((l) => !accountIds.has(l.ledgerAccountId))!.ledgerAccountId;
    expect(catMid).toBe(transportId);

    const undone = await repo.undoRuleRun(ran.value.undoId!);
    expect(undone.ok).toBe(true);
    const after = await repo.load();
    // Original id stays reversed; restore posts a new copy with Market again.
    const marketPosted = after.events.filter((e) => e.status === 'posted' && e.type === 'expense');
    const hasMarket = marketPosted.some((e) => e.lines.some((l) => l.ledgerAccountId === marketId));
    expect(hasMarket).toBe(true);
  });
});
