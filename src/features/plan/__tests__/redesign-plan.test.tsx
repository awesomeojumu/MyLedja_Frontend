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

async function seeded(opts?: { empty?: boolean }) {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank Current', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.rent', group: 'group.food', name: 'Rent' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  if (!opts?.empty) {
    await repo.addRecurring({
      kind: 'bill',
      name: 'Rent',
      amountMinor: '7500000',
      accountId: (await repo.load()).accounts[0]!.id,
      categoryId: (await repo.load()).categories.find((c) => c.kind === 'expense')!.id,
      rule: { every: 'month', on: 1 },
      startDate: '2026-10-01',
      reminderDays: 2,
      hideAmountOnLock: true,
    });
    await repo.addRecurring({
      kind: 'subscription',
      name: 'Spotify',
      amountMinor: '580000',
      accountId: (await repo.load()).accounts[0]!.id,
      categoryId: (await repo.load()).categories.find((c) => c.kind === 'expense')!.id,
      rule: { every: 'month', on: 4 },
      startDate: '2026-10-01',
    });
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

  it('shows Upcoming summary, sections, and segmented tabs', async () => {
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
    expect(screen.getByText('Rent')).toBeTruthy();
    expect(screen.getByText('Spotify')).toBeTruthy();
  });

  it('opens Add a bill sheet from plus and saves', async () => {
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
    expect(screen.getByText(t('plan.redesign.kindOut'))).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.saveBill'))).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('plan-redesign-name'), 'Electricity');
    await fireEvent.changeText(screen.getByTestId('plan-redesign-amount'), '15000');
    await fireEvent.press(screen.getByTestId('plan-redesign-save'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.recurring.some((r) => r.name === 'Electricity')).toBe(true);
    });
  });

  it('switches to Calendar and All tabs', async () => {
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

    await fireEvent.press(screen.getByText(t('plan.redesign.tabAll')));
    await setParams({ tab: 'all' });
    expect(await screen.findByTestId('plan-redesign-search')).toBeTruthy();
  });

  it('opens bill detail and Mark as paid', async () => {
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
    expect(screen.getByText(t('plan.redesign.nextPayment'))).toBeTruthy();
    expect(screen.getByText(t('plan.redesign.markAsPaid'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('plan-redesign-mark-paid'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.occurrences.some((o) => o.recurringId === bill.id && o.status === 'paid')).toBe(true);
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
