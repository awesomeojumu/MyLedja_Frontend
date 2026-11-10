import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { PlanScreen } from '../PlanScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

async function seeded(opts?: { empty?: boolean; lowBalance?: boolean; inflation?: boolean }) {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  const openingBalance = opts?.lowBalance ? '100000' : '100000000'; // ₦1,000 vs ₦1,000,000
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank Current', type: 'bank', openingBalance, openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.rent', group: 'group.food', name: 'Rent' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  if (!opts?.empty) {
    const snap = await repo.load();
    const bill = await repo.addRecurring({
      kind: 'bill',
      name: 'Rent',
      amountMinor: '7500000',
      accountId: snap.accounts[0]!.id,
      categoryId: snap.categories.find((c) => c.kind === 'expense')!.id,
      rule: { every: 'month', on: 1 },
      startDate: '2026-10-01',
      reminderDays: 2,
      hideAmountOnLock: true,
    });
    const sub = await repo.addRecurring({
      kind: 'subscription',
      name: 'Spotify',
      amountMinor: '580000',
      accountId: snap.accounts[0]!.id,
      categoryId: snap.categories.find((c) => c.kind === 'expense')!.id,
      rule: { every: 'month', on: 4 },
      startDate: '2026-10-01',
    });

    if (opts?.inflation) {
      // Add a past occurrence with lower amount (₦4,000)
      await repo.markBillPaid(sub.id, '2026-10-04', {
        accountId: snap.accounts[0]!.id,
        categoryId: snap.categories.find((c) => c.kind === 'expense')!.id,
        amount: 400000n,
        date: '2026-10-04',
      });
    }
  }
  return { sync, repo };
}

describe('Page 12 redesign Bills (EXPO_PUBLIC_REDESIGN on)', () => {
  it('shows Figma empty state when there are no bills', async () => {
    const { sync } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('redesign-plan')).toBeTruthy();
    expect(screen.getByTestId('plan-redesign-empty')).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.emptyBody'))).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.addABill'))).toBeTruthy();
  });

  it('shows Upcoming summary, sections, safe to spend, and progress label', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-redesign-segment')).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.tabUpcoming'))).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.tabAll'))).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.tabCalendar'))).toBeTruthy();
    expect(screen.getByTestId('plan-redesign-summary')).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.stillToPay'))).toBeTruthy();
    expect(screen.getByTestId('plan-safe-to-spend')).toBeTruthy();
    expect(screen.getByTestId('plan-progress-label')).toBeTruthy();
    expect(screen.getAllByText('Rent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Spotify')).toBeTruthy();
  });

  it('detects low balance buffer warning when funds are insufficient for upcoming bills', async () => {
    const { sync } = await seeded({ lowBalance: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-buffer-alert')).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.bufferAlertTitle'))).toBeTruthy();
  });

  it('detects subscription price hike and surfaces inflation alert', async () => {
    const { sync } = await seeded({ inflation: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-inflation-alert')).toBeTruthy();
  });

  it('supports grouping view toggles by status, category, and account', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-group-toggle')).toBeTruthy();
    expect(screen.getByTestId('plan-group-category')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('plan-group-category'));
    expect(screen.getAllByText('Rent').length).toBeGreaterThanOrEqual(1);
    await fireEvent.press(screen.getByTestId('plan-group-account'));
    expect(screen.getByText('GTBank Current')).toBeTruthy();
  });

  it('supports quick actions: quick pay, snooze, and skip', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    const rent = snap.recurring.find((r) => r.name === 'Rent')!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId(`plan-quick-pay-${rent.id}`)).toBeTruthy();
    expect(screen.getByTestId(`plan-quick-snooze-${rent.id}`)).toBeTruthy();
    expect(screen.getByTestId(`plan-quick-skip-${rent.id}`)).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`plan-quick-snooze-${rent.id}`));
    await fireEvent.press(screen.getByTestId(`plan-quick-skip-${rent.id}`));
    await waitFor(async () => {
      const updated = await repo.load();
      expect(updated.occurrences.some((o) => o.recurringId === rent.id && o.status === 'skipped')).toBe(true);
    });
  });

  it('opens Add a bill sheet with Nigerian templates and month-end clamping visualizer', async () => {
    const { sync, repo } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('plan-redesign-add'));
    await setParams({ schedule: 'new', kind: 'bill' });
    expect(await screen.findByTestId('plan-redesign-add-sheet')).toBeTruthy();
    expect(screen.getByTestId('plan-template-chips')).toBeTruthy();
    expect(screen.getByTestId('plan-template-EKEDC')).toBeTruthy();

    // Tap template
    await fireEvent.press(screen.getByTestId('plan-template-EKEDC'));
    expect(screen.getByTestId('plan-redesign-name').props.value).toBe('EKEDC');

    // Month end clamp test
    await fireEvent.changeText(screen.getByTestId('plan-redesign-day'), '31');
    expect(await screen.findByTestId('plan-last-day-hint')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('plan-redesign-save'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.recurring.some((r) => r.name === 'EKEDC')).toBe(true);
    });
  });

  it('switches to Calendar and All tabs with week strip', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByText(t('plan.redesign.tabCalendar')));
    await setParams({ tab: 'calendar' });
    expect(await screen.findByTestId('plan-redesign-calendar')).toBeTruthy();
    expect(screen.getByTestId('plan-week-strip')).toBeTruthy();

    await fireEvent.press(screen.getByText(t('plan.redesign.tabAll')));
    await setParams({ tab: 'all' });
    expect(await screen.findByTestId('plan-redesign-search')).toBeTruthy();
  });

  it('opens bill detail, shows copy payee & custom partial amount, and marks paid', async () => {
    const { sync, repo } = await seeded();
    const bill = (await repo.load()).recurring.find((r) => r.name === 'Rent')!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId(`plan-row-${bill.id}`));
    await setParams({ bill: bill.id });
    expect(await screen.findByTestId('plan-redesign-detail')).toBeTruthy();
    expect(screen.getByTestId('plan-copy-payee')).toBeTruthy();
    expect(screen.getByTestId('plan-custom-amount')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('plan-copy-payee'));

    // Custom partial payment: ₦35,000 out of ₦75,000
    await fireEvent.changeText(screen.getByTestId('plan-custom-amount'), '35000');
    await fireEvent.press(screen.getByTestId('plan-redesign-mark-paid'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.occurrences.some((o) => o.recurringId === bill.id && o.status === 'paid' && o.amountMinor === '3500000')).toBe(true);
    });
  });

  it('Back navigates to More', async () => {
    const { sync } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('redesign-back'));
    expect(router.push).toHaveBeenCalledWith('/more');
  });
});
