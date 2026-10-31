import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { RedesignReportsScreen } from '../RedesignReportsScreen';

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
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '81230000', openingDate: '2026-09-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  resetParams();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Redesign Reports (Figma 5:2297)', () => {
  it('shows featured catalogue, Your reports, Build your own, and no bottom nav', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignReportsScreen />), { sync });
    expect(await screen.findByTestId('redesign-reports')).toBeTruthy();
    expect(screen.getByText(t('reports.redesign.spendingByCategory'))).toBeTruthy();
    expect(screen.getByText(t('reports.redesign.spendingByCategoryBody'))).toBeTruthy();
    expect(screen.getByText(t('reports.redesign.incomeAndSpending'))).toBeTruthy();
    expect(screen.getByText(t('reports.redesign.netWorth'))).toBeTruthy();
    expect(screen.getByText(t('reports.redesign.spendingByPayee'))).toBeTruthy();
    expect(screen.getByTestId('redesign-reports-your-label')).toHaveTextContent(t('reports.redesign.yourReports'));
    // Mock seeds demo saved reports so the section is not a dead blank.
    expect(screen.getByText('Food each month')).toBeTruthy();
    expect(screen.getByText('Top payees')).toBeTruthy();
    expect(screen.queryByText(t('reports.redesign.noSaved'))).toBeNull();
    expect(screen.getByTestId('redesign-reports-build')).toBeTruthy();
    expect(screen.getByTestId('redesign-reports-add')).toBeTruthy();
    expect(screen.queryByTestId('redesign-bottom-nav')).toBeNull();
  });

  it('opens an existing featured report by kind', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignReportsScreen />), { sync });
    await screen.findByTestId('redesign-reports-row-spending_by_category');
    fireEvent.press(screen.getByTestId('redesign-reports-row-spending_by_category'));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/reports\/view\//));
    });
  });

  it('Build your own goes to the builder', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignReportsScreen />), { sync });
    await screen.findByTestId('redesign-reports-build');
    fireEvent.press(screen.getByTestId('redesign-reports-build'));
    expect(router.push).toHaveBeenCalledWith('/reports/build');
  });

  it('plus opens Add report gallery sheet', async () => {
    const { sync } = await seeded();
    setParams({ addReport: '1' });
    await renderWithProviders(wrap(<RedesignReportsScreen />), { sync });
    expect(await screen.findByTestId('redesign-reports-gallery')).toBeTruthy();
    expect(screen.getByTestId('redesign-gallery-build')).toBeTruthy();
  });

  it('lists a saved builder report under Your reports', async () => {
    const { sync, repo } = await seeded();
    const saved = await repo.saveReport({
      name: 'Food each month',
      spec: { show: 'spending', groupBy: 'category', splitBy: 'month', chart: 'bar', filters: {} },
    });
    await renderWithProviders(wrap(<RedesignReportsScreen />), { sync });
    expect(await screen.findByTestId(`redesign-reports-saved-${saved.id}`)).toBeTruthy();
    expect(screen.getByText('Food each month')).toBeTruthy();
  });
});
