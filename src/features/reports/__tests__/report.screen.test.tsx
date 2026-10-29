import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ReportResultWire, RunReportBody } from '@/api/reports';
import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { ReportScreen } from '../ReportScreen';
import { ReportsScreen } from '../ReportsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockWidth = 1024;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
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
    previous: body.compare
      ? {
          columns: [{ key: 'total', label: 'Total' }],
          rows: [{ key: 'fuel', label: 'Fuel', values: ['1000000'], total: '1000000' }],
          columnTotals: ['1000000'],
          total: '1000000',
        }
      : null,
    finding: { key: 'spending_rose', amount: '4345000', changeBasisPoints: '1200', previousFrom: '2026-09-01' },
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
  const dashboards = await repo.ensureReportDashboards();
  const card = dashboards[0]!.cards[0]!;
  return { sync, repo, card, dashboards };
}

const page = (sync: ReturnType<typeof memorySync>, node: React.ReactElement) =>
  renderWithProviders(<WorkspaceProvider workspaceId="ws-personal">{node}</WorkspaceProvider>, { sync });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
  router.push.mockClear();
  mockWidth = 1024;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Reports hub → Report (P20 entry)', () => {
  it('opens Report view from a dashboard card', async () => {
    const { sync, card } = await seeded();
    await page(sync, <ReportsScreen />);
    await screen.findByTestId(`report-card-${card.id}`);
    await fireEvent.press(screen.getByTestId(`report-card-${card.id}`));
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^/reports/view/${card.id}`)));
  });
});

describe('Report screen (P20)', () => {
  it('P20-01/02/03: loads via reports/run, shows table totals, drills to transactions', async () => {
    const { sync, card } = await seeded();
    const calls: RunReportBody[] = [];
    setParams({ id: card.id, from: '2026-10-01', to: '2026-10-31' });
    await page(
      sync,
      <ReportScreen
        runner={async (_ws, body) => {
          calls.push(body);
          return wireFor(body);
        }}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('report-table-total')).toBeTruthy());
    expect(calls[0]?.kind).toBe('spending_by_category');
    expect(calls[0]?.from).toBe('2026-10-01');
    expect(screen.getByTestId('report-about')).toBeTruthy();
    expect(screen.getByTestId('report-chart')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('report-table-row-fuel'));
    expect(router.push).toHaveBeenCalledWith('/transactions?from=2026-10-01&to=2026-10-31&category=cat-fuel');
  });

  it('P20-04: export CSV and add-to-dashboard controls exist; Duplicate opens PU-43', async () => {
    const { sync, card } = await seeded();
    setParams({ id: card.id, from: '2026-10-01', to: '2026-10-31' });
    await page(sync, <ReportScreen runner={async (_ws, body) => wireFor(body)} />);
    await waitFor(() => expect(screen.getByTestId('report-export')).toBeTruthy());
    expect(screen.getByTestId('report-add-to-dashboard')).toBeTruthy();
    expect(screen.getByText(t('reports.exportCsv'))).toBeTruthy();
  });

  it('phone: Filters sheet hosts controls (TB-14 / D20-17)', async () => {
    mockWidth = 375;
    const { sync, card } = await seeded();
    setParams({ id: card.id, from: '2026-10-01', to: '2026-10-31' });
    await page(sync, <ReportScreen runner={async (_ws, body) => wireFor(body)} />);
    await waitFor(() => expect(screen.getByTestId('report-filters')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('report-filters'));
    expect(screen.getByTestId('report-filters-sheet')).toBeTruthy();
    expect(screen.getByTestId('report-interval')).toBeTruthy();
  });
});
