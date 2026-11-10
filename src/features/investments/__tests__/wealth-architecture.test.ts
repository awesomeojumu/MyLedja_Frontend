import { describe, expect, it } from '@jest/globals';

import { MemoryKeyValue } from '@/data/kv.shared';
import { LocalStore } from '@/data/sync/LocalStore';
import { SyncEngine } from '@/data/sync/SyncEngine';
import { MockSyncServer } from '@/api/mocks/sync';
import { WorkspaceRepository } from '@/data/workspace/repository';
import {
  calculateCAGR,
  holdingDuration,
  isGrowthAsset,
  isYieldAsset,
  portfolioSummary,
} from '../helpers';

async function setupRepo() {
  const store = new LocalStore(new MemoryKeyValue());
  const server = new MockSyncServer();
  const engine = new SyncEngine({ store, transport: server, deviceId: 'test-device' });
  const repo = new WorkspaceRepository(store, engine, 'ws-wealth');
  await repo.seedFromSetup({
    workspaceName: 'Wealth Management',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '5000000000', openingDate: '2024-01-01' },
      { name: 'Holdings Account', type: 'investment', openingBalance: '0', openingDate: '2024-01-01' },
    ],
    categories: [{ key: 'cat.investment', group: 'group.savings', name: 'Investments' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return repo;
}

describe('P17 & P18 Wealth Architecture & Land / Capital Growth Suite', () => {
  it('correctly classifies assets into Yield vs Growth categories', () => {
    expect(isYieldAsset('stock')).toBe(true);
    expect(isYieldAsset('fund')).toBe(true);
    expect(isYieldAsset('fixedDeposit')).toBe(true);
    expect(isYieldAsset('pension')).toBe(true);

    expect(isGrowthAsset('land')).toBe(true);
    expect(isGrowthAsset('realEstate')).toBe(true);
    expect(isGrowthAsset('preciousMetals')).toBe(true);
    expect(isGrowthAsset('crypto')).toBe(true);
    expect(isGrowthAsset('privateEquity')).toBe(true);
    expect(isGrowthAsset('other')).toBe(true);
  });

  it('calculates CAGR accurately over multi-year holding horizons', () => {
    // ₦10m cost growing to ₦14.4m over 2 years = 20.0% p.a.
    const cagr = calculateCAGR(14_400_000n, 10_000_000n, '2024-01-01', '2026-01-01');
    expect(cagr).toBeCloseTo(20.0, 0);

    // Holding under 3 months returns null
    const shortTerm = calculateCAGR(12_000_000n, 10_000_000n, '2026-01-01', '2026-01-20');
    expect(shortTerm).toBeNull();
  });

  it('formats human-readable holding duration', () => {
    expect(holdingDuration('2023-01-01', '2026-01-01')).toBe('3y');
    expect(holdingDuration('2025-07-01', '2026-01-01')).toBe('6m');
    expect(holdingDuration('2024-05-01', '2026-01-01')).toBe('1y 8m');
  });

  it('records Land purchase and tracks capital improvements to adjusted cost basis', async () => {
    const repo = await setupRepo();
    const snapInitial = await repo.load();
    const bank = snapInitial.accounts.find((a) => a.type === 'bank')!;
    const invAcc = snapInitial.accounts.find((a) => a.type === 'investment')!;

    // Seed land holding: 2 Plots in Epe for ₦14,000,000
    const landRes = await repo.seedHoldingBook({
      name: '2 Plots in Epe Corridor',
      type: 'land',
      accountId: invAcc.id,
      costMinor: 14_000_000_00n,
      valueMinor: 14_000_000_00n,
      unitType: 'plots',
      units: '2',
      location: 'Epe, Lagos State',
      titleStatus: 'Registered Survey',
    });
    expect(landRes.ok).toBe(true);
    const land = (landRes as { ok: true; value: { id: string; location?: string; unitType?: string } }).value;
    expect(land.location).toBe('Epe, Lagos State');
    expect(land.unitType).toBe('plots');

    // Add Capital Improvement: Fencing for ₦1,500,000 paid from GTBank
    const impRes = await repo.addCapitalImprovement(land.id, {
      amountMinor: 1_500_000_00n,
      date: '2024-06-01',
      category: 'Fencing',
      note: 'Perimeter wire and block fencing',
      cashAccountId: bank.id,
    });
    expect(impRes.ok).toBe(true);

    // Verify snapshot reflects adjusted cost basis
    const snap = await repo.load();
    const lots = snap.lots.filter((l) => l.holdingId === land.id);
    expect(lots.length).toBe(2);
    const totalCost = lots.reduce((s, l) => s + BigInt(l.costMinor), 0n);
    expect(totalCost).toBe(15_500_000_00n); // ₦14m + ₦1.5m fencing
  });

  it('handles write-off and calculates portfolio drag without corrupting living expenses', async () => {
    const repo = await setupRepo();
    const snapInitial = await repo.load();
    const invAcc = snapInitial.accounts.find((a) => a.type === 'investment')!;

    const tokenRes = await repo.seedHoldingBook({
      name: 'Defi Protocol Token',
      type: 'crypto',
      accountId: invAcc.id,
      costMinor: 5_000_000_00n,
      valueMinor: 5_000_000_00n,
    });
    expect(tokenRes.ok).toBe(true);
    const token = (tokenRes as { ok: true; value: { id: string } }).value;

    // Write off token due to protocol collapse
    const writeOffRes = await repo.writeOffHolding(token.id, {
      kind: 'full',
      amountMinor: 5_000_000_00n,
      date: '2025-08-01',
      reason: 'Token collapse or fraud',
      notes: 'Smart contract exploit led to zero liquidity',
    });
    expect(writeOffRes.ok).toBe(true);

    const snap = await repo.load();
    const updated = snap.holdings.find((h) => h.id === token.id);
    expect(updated?.isWrittenOff).toBe(true);
    expect(updated?.writeOffReason).toBe('Token collapse or fraud');

    const summary = portfolioSummary(snap, '1Y', '2026-01-01');
    expect(summary.archivedAssets.length).toBe(1);
    expect(summary.writtenOffLossTotal).toBe(5_000_000_00n);
    expect(summary.portfolioDrag).toBeGreaterThan(0);
  });

  it('computes portfolio liquidity tiers accurately', async () => {
    const repo = await setupRepo();
    const snapInitial = await repo.load();
    const invAcc = snapInitial.accounts.find((a) => a.type === 'investment')!;

    // Semi-liquid stock
    await repo.seedHoldingBook({
      name: 'MTN Nigeria',
      type: 'stock',
      accountId: invAcc.id,
      costMinor: 2_000_000_00n,
      valueMinor: 2_000_000_00n,
    });

    // Illiquid land
    await repo.seedHoldingBook({
      name: 'Ibeju Lekki Plot',
      type: 'land',
      accountId: invAcc.id,
      costMinor: 5_000_000_00n,
      valueMinor: 5_000_000_00n,
    });

    const snap = await repo.load();
    const summary = portfolioSummary(snap, '1Y', '2026-01-01');

    // All liquidity tiers sum up properly
    const totalPct =
      summary.liquidity.liquid.pct + summary.liquidity.semiLiquid.pct + summary.liquidity.illiquid.pct;
    expect(totalPct).toBe(100);
    expect(summary.liquidity.semiLiquid.pct).toBeGreaterThan(0);
    expect(summary.liquidity.illiquid.pct).toBeGreaterThan(0);
  });
});
