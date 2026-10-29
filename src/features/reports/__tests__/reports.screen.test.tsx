import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Share } from 'react-native';

import type { ReportResultWire, ReportTableWire } from '@/api/reports';
import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { reportCsv } from '../helpers';
import { ReportBuilderScreen } from '../ReportBuilderScreen';
import { ReportScreen, type ReportRunner } from '../ReportScreen';
import { ReportsScreen } from '../ReportsScreen';
import { runReport } from '../runner';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockWidth = 375;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

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
  const s = await repo.load();
  const id = (name: string) => (s.accounts.find((a) => a.name === name) ?? s.categories.find((c) => c.name === name))!.id;
  const spend = (category: string, amount: bigint, date: string) =>
    repo.addTransaction({ kind: 'expense', accountId: id('GTBank'), parts: [{ categoryId: id(category), amount }], date, payeeName: 'Shop' });
  await spend('Market', 1_845_000n, '2026-10-02');
  await spend('Fuel', 2_500_000n, '2026-10-06');
  await spend('Market', 1_000_000n, '2026-09-10');
  await repo.addTransaction({ kind: 'income', accountId: id('GTBank'), categoryId: s.categories.find((c) => c.kind === 'income')!.id, amount: 200_000_000n, date: '2026-10-05' });
  return { sync, repo, id };
}

/** A stand-in for POST reports/run: the app's engine on this device's data, answered as the server would. */
const serverOn =
  (repo: WorkspaceRepository): ReportRunner =>
  async (_ws, body) => {
    const r = runReport(
      await repo.load(),
      {
        kind: body.kind,
        from: body.from,
        to: body.to,
        interval: body.interval ?? 'month',
        compare: body.compare,
        filters: body.filters,
        spec: body.spec ?? null,
        formula: body.formula ?? null,
      },
      '2026-10-28',
    );
    const wire = (x: typeof r.table): ReportTableWire => ({
      columns: x.columns,
      rows: x.rows.map((row) => ({ key: row.key, label: row.label, values: row.values.map(String), total: String(row.total) })),
      columnTotals: x.columnTotals.map(String),
      total: String(x.total),
    });
    const drill: ReportResultWire['drill'] = {};
    for (const [key, d] of Object.entries(r.drill)) {
      drill[key] = {
        from: d.from,
        to: d.to,
        ...(d.accountId ? { accountIds: [d.accountId] } : {}),
        ...(d.categoryId ? { categoryIds: [d.categoryId] } : {}),
        ...(d.payeeId ? { payeeIds: [d.payeeId] } : {}),
      };
    }
    return {
      kind: r.kind,
      from: r.range.from,
      to: r.range.to,
      interval: body.interval ?? 'month',
      chart: r.chart,
      unit: r.unit,
      table: wire(r.table),
      previous: r.previous ? wire(r.previous) : null,
      finding: r.finding && {
        key: r.finding.key,
        amount: r.finding.amount === null ? null : String(r.finding.amount),
        changeBasisPoints: r.finding.changeBasisPoints === null ? null : String(r.finding.changeBasisPoints),
        previousFrom: r.finding.previousFrom,
      },
      drill,
      partial: r.partial,
      note: null,
    };
  };

const page = (sync: ReturnType<typeof memorySync>, node: React.ReactElement) =>
  renderWithProviders(<WorkspaceProvider workspaceId="ws-personal">{node}</WorkspaceProvider>, { sync });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
  router.push.mockClear();
  mockWidth = 375;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('report runner (F5.2)', () => {
  it('B5.2: the chart and the table read the same rows, and refunds and transfers are not spending', async () => {
    const { repo, id } = await seeded();
    const s = await repo.load();
    const r = runReport(s, { kind: 'spending_by_category', from: '2026-10-01', to: '2026-10-31', interval: 'month' }, '2026-10-28');
    expect(r.table.total).toBe(4_345_000n);
    expect(r.table.rows.find((x) => x.key === id('Market'))?.total).toBe(1_845_000n);
    expect(r.finding?.key).toBe('spending_rose');
    expect(r.drill[id('Fuel')]).toEqual({ from: '2026-10-01', to: '2026-10-31', categoryId: id('Fuel') });
  });

  it('income vs expenses, net worth and a formula', async () => {
    const { repo } = await seeded();
    const s = await repo.load();
    const ive = runReport(s, { kind: 'income_vs_expenses', from: '2026-10-01', to: '2026-10-31', interval: 'month' }, '2026-10-28');
    expect(ive.table.rows[0]?.values).toEqual([200_000_000n, 4_345_000n]);
    const worth = runReport(s, { kind: 'net_worth', from: '2026-09-01', to: '2026-10-31', interval: 'month' }, '2026-10-28');
    expect(worth.table.total).toBe(81_230_000n - 1_000_000n - 4_345_000n + 200_000_000n);
    const f = runReport(s, { kind: 'formula', from: '2026-10-01', to: '2026-10-31', interval: 'month', formula: 'income - spending' }, '2026-10-28');
    expect(f.table.total).toBe(200_000_000n - 4_345_000n);
    const bad = runReport(s, { kind: 'formula', from: '2026-10-01', to: '2026-10-31', interval: 'month', formula: 'income -' }, '2026-10-28');
    expect(bad.error).toBe('formula');
  });

  it('P20-02: CSV has every row and the totals', async () => {
    const { repo } = await seeded();
    const s = await repo.load();
    const csv = reportCsv(runReport(s, { kind: 'spending_by_category', from: '2026-10-01', to: '2026-10-31', interval: 'month' }, '2026-10-28'));
    expect(csv.split('\n')).toEqual(['Name,Total', 'Fuel,25000', 'Market,18450', 'Total,43450']);
  });
});

describe('Reports page (F5.2)', () => {
  it('P19-01: starts with Overview and Year in review, and each card opens its report', async () => {
    const { sync } = await seeded();
    await page(sync, <ReportsScreen />);
    const tabs = await screen.findByTestId('reports-tabs');
    expect(within(tabs).getByText(t('reports.overview'))).toBeTruthy();
    expect(within(tabs).getByText(t('reports.yearInReview'))).toBeTruthy();
    expect(screen.getByTestId('report-card-default-0')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('report-open-default-2'));
    expect(router.push).toHaveBeenCalledWith('/reports/view/default-2');
  });

  it('P19-04, P19-05: edit layout moves cards, keeps one highlight, and saves', async () => {
    const { sync, repo } = await seeded();
    await page(sync, <ReportsScreen />);
    await fireEvent.press(await screen.findByTestId('reports-edit-layout'));
    await fireEvent.press(screen.getByTestId('card-down-default-0'));
    await waitFor(async () => {
      const d = (await repo.load()).reportDashboards;
      expect(d.map((x) => x.name)).toEqual([t('reports.overview'), t('reports.yearInReview')]);
      expect(d[0]!.cards.map((c) => c.id).slice(0, 2)).toEqual(['default-1', 'default-0']);
    });
    await fireEvent.press(await screen.findByTestId('card-highlight-default-2'));
    await waitFor(async () => expect((await repo.load()).reportDashboards[0]!.cards.find((c) => c.highlight)?.id).toBe('default-2'));
    await fireEvent.press(screen.getByTestId('card-highlight-default-3'));
    await waitFor(async () => {
      const cards = (await repo.load()).reportDashboards[0]!.cards;
      expect(cards.filter((c) => c.highlight).map((c) => c.id)).toEqual(['default-3']);
    });
  });


  it('PU42-1: two dashboards cannot share a name', async () => {
    const { sync } = await seeded();
    await page(sync, <ReportsScreen />);
    await fireEvent.press(await screen.findByTestId('reports-new-dashboard'));
    await fireEvent.changeText(screen.getByTestId('dashboard-name'), t('reports.overview'));
    expect(screen.getByTestId('dashboard-name-save')).toBeDisabled();
  });

  it('P19-02: Add report puts a card from the gallery on the dashboard', async () => {
    const { sync, repo } = await seeded();
    await page(sync, <ReportsScreen />);
    await fireEvent.press(await screen.findByTestId('reports-add'));
    await fireEvent.press(screen.getByTestId('gallery-summary_number'));
    await waitFor(async () => expect((await repo.load()).reportDashboards[0]?.cards.at(-1)?.kind).toBe('summary_number'));
  });
});

describe('Report page (F5.2)', () => {
  it('P20-01, P20-03: the table has every number with totals, and a row opens its transactions', async () => {
    const { sync, repo, id } = await seeded();
    setParams({ id: 'default-2', from: '2026-10-01', to: '2026-10-31' });
    await page(sync, <ReportScreen runner={serverOn(repo)} />);
    expect(await screen.findByTestId('report-table-total')).toHaveTextContent('₦43,450.00');
    await fireEvent.press(screen.getByTestId(`report-table-row-${id('Market')}`));
    expect(router.push).toHaveBeenCalledWith(`/transactions?from=2026-10-01&to=2026-10-31&category=${id('Market')}`);
  });

  it('P20-02: Export CSV shares the table', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const { sync, repo } = await seeded();
    setParams({ id: 'default-2', from: '2026-10-01', to: '2026-10-31' });
    await page(sync, <ReportScreen runner={serverOn(repo)} />);
    await fireEvent.press(await screen.findByTestId('report-export'));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Total,43450') }));
  });

  it('on a phone the controls are in a Filters sheet', async () => {
    const { sync, repo } = await seeded();
    setParams({ id: 'default-2', from: '2026-10-01', to: '2026-10-31' });
    await page(sync, <ReportScreen runner={serverOn(repo)} />);
    await fireEvent.press(await screen.findByTestId('report-filters'));
    expect(screen.getByTestId('report-filters-sheet')).toBeTruthy();
  });
});

describe('Report builder (F5.2)', () => {
  it('P21-01: saves a report and puts it on the dashboard', async () => {
    mockWidth = 1200;
    const { sync, repo } = await seeded();
    setParams({ dashboard: 'default-dashboard-0' });
    await page(sync, <ReportBuilderScreen />);
    await fireEvent.press(await screen.findByTestId('builder-show'));
    await fireEvent.press(screen.getByRole('radio', { name: t('reports.show.income') }));
    expect(await screen.findByTestId('builder-preview-table')).toHaveTextContent('₦2,000,000.00', { exact: false });
    await fireEvent.press(screen.getByTestId('builder-save'));
    await fireEvent.changeText(screen.getByTestId('save-report-name'), 'Pay');
    await fireEvent.press(screen.getByTestId('save-report-confirm'));
    await waitFor(async () => {
      const s = await repo.load();
      const saved = s.savedReports.find((r) => r.name === 'Pay');
      expect(saved?.spec.show).toBe('income');
      expect(s.reportDashboards[0]?.cards.at(-1)?.savedReportId).toBe(saved?.id);
    });
  });

  it('P21-02: leaving with changes asks first', async () => {
    mockWidth = 1200;
    const { sync } = await seeded();
    await page(sync, <ReportBuilderScreen />);
    await fireEvent.press(await screen.findByTestId('builder-show'));
    await fireEvent.press(screen.getByRole('radio', { name: t('reports.show.count') }));
    await fireEvent.press(screen.getByTestId('builder-back'));
    expect(screen.getByText(t('reports.discardTitle'))).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
