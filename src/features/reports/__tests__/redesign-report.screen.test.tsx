import { fireEvent, screen } from '@testing-library/react-native';

import type { ReportResultWire, RunReportBody } from '@/api/reports';
import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { RedesignReportScreen } from '../RedesignReportScreen';
import { newCard } from '../helpers';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/design/redesign/flag', () => ({
  isRedesignEnabled: () => true,
}));

function wireFor(body: RunReportBody): ReportResultWire {
  return {
    kind: body.kind,
    from: body.from,
    to: body.to,
    interval: body.interval ?? 'month',
    chart: 'bar',
    unit: 'money',
    table: {
      columns: [{ key: 'total', label: 'Total' }],
      rows: [
        { key: 'fuel', label: 'Fuel', values: ['2500000'], total: '2500000' },
        { key: 'market', label: 'Market', values: ['1845000'], total: '1845000' },
      ],
      columnTotals: ['4345000'],
      total: '4345000',
    },
    previous: {
      columns: [{ key: 'total', label: 'Total' }],
      rows: [{ key: 'fuel', label: 'Fuel', values: ['1000000'], total: '1000000' }],
      columnTotals: ['5175000'],
      total: '5175000',
    },
    finding: { key: 'spending_rose', amount: '4345000', changeBasisPoints: '-1600', previousFrom: '2026-09-01' },
    drill: {
      fuel: { from: body.from, to: body.to, categoryIds: ['cat-fuel'] },
      market: { from: body.from, to: body.to, categoryIds: ['cat-market'] },
    },
    partial: [],
    note: null,
  };
}

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '81230000', openingDate: '2026-09-01' }],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Market' },
      { key: 'cat.fuel', group: 'group.transport', name: 'Fuel' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo, card: { id: 'default-2' } };
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

describe('Redesign Report (Figma 5:2369 / 12:6128)', () => {
  it('shows range chips, total, breakdown, View as table, and no bottom nav', async () => {
    const { sync, card } = await seeded();
    setParams({ id: card.id });
    await renderWithProviders(
      wrap(<RedesignReportScreen runner={async (_ws, body) => wireFor(body)} />),
      { sync },
    );
    expect(await screen.findByTestId('redesign-report-total')).toBeTruthy();
    expect(screen.getByTestId('redesign-report-range-this_month')).toBeTruthy();
    expect(screen.getByTestId('redesign-report-range-last_3_months')).toHaveTextContent(t('reports.redesign.chip3Months'));
    expect(screen.getByTestId('redesign-report-breakdown')).toBeTruthy();
    expect(screen.getByTestId('redesign-report-view-table')).toBeTruthy();
    expect(screen.getByTestId('redesign-report-more')).toBeTruthy();
    expect(screen.queryByTestId('redesign-bottom-nav')).toBeNull();
  });

  it('View as table toggles and drills a row', async () => {
    const { sync, card } = await seeded();
    setParams({ id: card.id, view: 'table' });
    await renderWithProviders(
      wrap(<RedesignReportScreen runner={async (_ws, body) => wireFor(body)} />),
      { sync },
    );
    expect(await screen.findByTestId('redesign-report-table')).toBeTruthy();
    fireEvent.press(screen.getByTestId('redesign-report-table-row-fuel'));
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/\/transactions\?/));
  });

  it('more opens Share report sheet with CSV / PDF / image', async () => {
    const { sync, card } = await seeded();
    setParams({ id: card.id, share: '1' });
    await renderWithProviders(
      wrap(<RedesignReportScreen runner={async (_ws, body) => wireFor(body)} />),
      { sync },
    );
    expect(await screen.findByTestId('redesign-report-share')).toBeTruthy();
    expect(screen.getByText(t('reports.redesign.shareReport'))).toBeTruthy();
    expect(screen.getByTestId('redesign-report-share-csv')).toBeTruthy();
    expect(screen.getByTestId('redesign-report-share-pdf')).toBeTruthy();
    expect(screen.getByTestId('redesign-report-hide-amounts')).toBeTruthy();
  });

  it('missing card shows empty state', async () => {
    const { sync } = await seeded();
    setParams({ id: 'missing-card' });
    await renderWithProviders(
      wrap(<RedesignReportScreen runner={async (_ws, body) => wireFor(body)} />),
      { sync },
    );
    expect(await screen.findByTestId('redesign-report-missing')).toBeTruthy();
  });

  it('load error shows Try again', async () => {
    const { sync, card } = await seeded();
    setParams({ id: card.id });
    await renderWithProviders(
      wrap(
        <RedesignReportScreen
          runner={async () => {
            throw new Error('offline');
          }}
        />,
      ),
      { sync },
    );
    expect(await screen.findByTestId('redesign-report-failed')).toBeTruthy();
    expect(screen.getByText(t('reports.redesign.loadFailedTitle'))).toBeTruthy();
  });

  it('Mock API builds Spending by payee (custom + payee) without an injected runner', async () => {
    const { sync, repo } = await seeded();
    const card = newCard('payee-card', 'custom', 0, {
      title: 'Spending by payee',
      range: 'this_month',
      spec: { show: 'spending', groupBy: 'payee', splitBy: null, chart: 'bar', filters: {} },
    });
    await repo.createDashboard('Overview', [card]);
    setParams({ id: card.id });
    // No runner: uses AuthProvider Mock transport → createReportsMock.
    await renderWithProviders(wrap(<RedesignReportScreen />), { sync });
    expect(await screen.findByTestId('redesign-report-total')).toBeTruthy();
    expect(screen.queryByTestId('redesign-report-failed')).toBeNull();
    expect(screen.getByText('Shoprite')).toBeTruthy();
    expect(screen.getByText('Total Energies')).toBeTruthy();
  });
});
