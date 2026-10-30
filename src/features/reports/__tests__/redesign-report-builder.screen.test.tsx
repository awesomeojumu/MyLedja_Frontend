import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { RedesignReportBuilderScreen } from '../RedesignReportBuilderScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/design/redesign/flag', () => ({
  isRedesignEnabled: () => true,
}));

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
      { key: 'cat.fuel', group: 'group.gettingAround', name: 'Fuel' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const bank = s.accounts[0]!;
  const market = s.categories.find((c) => c.name === 'Market')!;
  await repo.addTransaction({
    kind: 'expense',
    accountId: bank.id,
    parts: [{ categoryId: market.id, amount: 5_000_000n }],
    date: '2026-10-05',
    payeeName: 'Shop',
  });
  return { sync, repo };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  resetParams();
  router.push.mockClear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Redesign Report builder (Figma 5:2436)', () => {
  it('shows Build a report fields, period chips, preview, Save, no bottom nav', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignReportBuilderScreen />), { sync });
    expect(await screen.findByTestId('redesign-builder-save')).toBeTruthy();
    expect(screen.getByText(t('reports.redesign.buildTitle'))).toBeTruthy();
    expect(screen.getByTestId('redesign-builder-name')).toBeTruthy();
    expect(screen.getByTestId('redesign-builder-show')).toBeTruthy();
    expect(screen.getByTestId('redesign-builder-group')).toBeTruthy();
    expect(screen.getByTestId('redesign-builder-period-6m')).toBeTruthy();
    expect(screen.getByTestId('redesign-builder-preview')).toBeTruthy();
    expect(screen.queryByTestId('redesign-bottom-nav')).toBeNull();
  });

  it('requires a name before save', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignReportBuilderScreen />), { sync });
    await screen.findByTestId('redesign-builder-save');
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-builder-save'));
    });
    expect(await screen.findByText(t('reports.redesign.nameRequired'))).toBeTruthy();
  });

  it('opens Show picker and updates value', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignReportBuilderScreen />), { sync });
    await screen.findByTestId('redesign-builder-show');
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-builder-show'));
    });
    expect(await screen.findByTestId('redesign-builder-pick-show')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-builder-option-income'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('redesign-builder-show')).toHaveTextContent(t('reports.show.income'));
    });
  });

  it('asks to discard when leaving dirty', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignReportBuilderScreen />), { sync });
    await screen.findByTestId('redesign-builder-name');
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('redesign-builder-name'), 'Food each month');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-back'));
    });
    expect(await screen.findByTestId('redesign-builder-discard')).toBeTruthy();
    expect(screen.getByText(t('reports.discardTitle'))).toBeTruthy();
  });

  it('saves a named report and returns to Reports', async () => {
    const { sync, repo } = await seeded();
    await renderWithProviders(wrap(<RedesignReportBuilderScreen />), { sync });
    await screen.findByTestId('redesign-builder-name');
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('redesign-builder-name'), 'Food each month');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-builder-save'));
    });
    await waitFor(async () => {
      const snap = await repo.load();
      expect(snap.savedReports.some((r) => r.name === 'Food each month')).toBe(true);
    });
    expect(router.push).toHaveBeenCalledWith('/reports');
  });
});
