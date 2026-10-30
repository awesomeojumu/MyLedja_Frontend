import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { DashboardScreen } from '../DashboardScreen';
import {
  DEFAULT_REDESIGN_HIDDEN_LARGER,
  DEFAULT_REDESIGN_HIDDEN_PHONE,
  resolveRedesignLayout,
  visibleRedesignCards,
} from '../redesignLayout';
import { monthlyAverages, redesignChecklist, comingUpWeek } from '../redesignHelpers';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
  router.push.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  await repo.addTransaction({
    kind: 'income',
    accountId: s.accounts[0]!.id,
    categoryId: s.categories.find((c) => c.kind === 'income')!.id,
    amount: 100_000_000n,
    date: '2026-10-05',
  });
  await repo.setAssigned(s.categories.find((c) => c.name === 'Market')!.id, '2026-10', 50_000_000n);
  return { sync, repo };
}

describe('redesignLayout', () => {
  it('phone default hides Monthly averages (Mobile Edit 2:1199)', () => {
    const layout = resolveRedesignLayout(undefined, 'phone');
    expect(visibleRedesignCards(layout, 'phone')).toEqual([
      'leftToSpend',
      'netWorth',
      'comingUp',
      'budget',
      'recent',
      'goals',
    ]);
    expect(layout.hidden).toEqual(DEFAULT_REDESIGN_HIDDEN_PHONE);
    expect(DEFAULT_REDESIGN_HIDDEN_PHONE).toContain('averages');
  });

  it('tablet/web default shows Monthly averages between Net worth and Coming up', () => {
    const layout = resolveRedesignLayout(undefined, 'larger');
    expect(visibleRedesignCards(layout, 'larger')).toEqual([
      'leftToSpend',
      'netWorth',
      'averages',
      'comingUp',
      'budget',
      'recent',
      'goals',
    ]);
    expect(layout.hidden).toEqual(DEFAULT_REDESIGN_HIDDEN_LARGER);
    expect(DEFAULT_REDESIGN_HIDDEN_LARGER).not.toContain('averages');
  });
});

describe('Page 05 redesign Home (EXPO_PUBLIC_REDESIGN on)', () => {
  it('renders Figma phone card stack and Edit Home', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-home')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-left')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-net-worth')).toBeTruthy();
    expect(screen.queryByTestId('redesign-home-averages')).toBeNull();
    expect(screen.getByTestId('redesign-home-coming-up')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-budget')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-recent')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-goals')).toBeTruthy();
    expect(screen.queryByTestId('redesign-home-investments')).toBeNull();
    expect(screen.getByTestId('redesign-home-edit')).toBeTruthy();
    expect(screen.getByText(t('dashboard.redesign.editHome'))).toBeTruthy();
  });

  it('opens Edit Home sheet from Edit Home with live Figma hint', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await screen.findByTestId('redesign-home');
    await fireEvent.press(screen.getByTestId('redesign-home-edit'));
    expect(await screen.findByTestId('redesign-edit-home')).toBeTruthy();
    expect(screen.getByText(t('dashboard.redesign.editHint'))).toBeTruthy();
    expect(t('dashboard.redesign.editHint')).toBe('Drag to move. Switch off what you do not need.');
    expect(screen.getByTestId('redesign-edit-toggle-averages').props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it('Goals ring centre uses phone out of 100 copy', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const added = await repo.addGoal({
      name: 'Emergency fund',
      targetMinor: 100_000_000n,
      accountId: s.accounts[0]!.id,
      targetDate: '2027-03-01',
      alreadySavedMinor: 72_000_000n,
    });
    expect(added.ok).toBe(true);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-home-goals-ring')).toBeTruthy();
    expect(screen.getByText(t('dashboard.redesign.outOf100'))).toBeTruthy();
  });

  it('shows Get started checklist until hidden', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-home-checklist')).toBeTruthy();
    expect(screen.getByText(t('dashboard.redesign.getStarted'))).toBeTruthy();
    expect(screen.getByTestId('redesign-home-check-bills')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-check-rule')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-checklist-cta')).toBeTruthy();
  });

  it('Open budget doorway goes to /budget', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await screen.findByTestId('redesign-home-open-budget');
    await fireEvent.press(screen.getByTestId('redesign-home-open-budget'));
    expect(router.push).toHaveBeenCalledWith('/budget');
  });

  it('helpers: averages, checklist, coming up 7 days', async () => {
    const { repo } = await seeded();
    const s = await repo.load();
    const avg = monthlyAverages(s, '2026-10');
    expect(avg.avgIncome).toBeGreaterThanOrEqual(0n);
    const checks = redesignChecklist(s, false);
    expect(checks).toHaveLength(5);
    expect(checks.find((c) => c.key === 'account')?.done).toBe(true);
    expect(checks.find((c) => c.key === 'rule')?.done).toBe(false);
    await repo.addRecurring({
      kind: 'bill',
      name: 'Rent',
      amountMinor: '5000000',
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === 'expense')!.id,
      rule: { every: 'month', on: 30 },
      startDate: '2026-10-01',
    });
    const s2 = await repo.load();
    const week = comingUpWeek(s2, '2026-10-28');
    expect(week.some((r) => r.recurring.name === 'Rent')).toBe(true);
  });
});
