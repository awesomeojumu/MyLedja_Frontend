import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams } from '../../../../test/helpers/router';
import { ReportBuilderScreen } from '../ReportBuilderScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/size', () => ({
  useSizeClass: () => 'desktop',
  sizeClassFor: () => 'desktop',
}));

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
  return { sync, repo };
}

async function openBuilder(sync: ReturnType<typeof memorySync>) {
  await renderWithProviders(
    <WorkspaceProvider workspaceId="ws-personal">
      <ReportBuilderScreen />
    </WorkspaceProvider>,
    { sync },
  );
  expect(await screen.findByTestId('builder-controls')).toBeTruthy();
}

beforeEach(() => {
  resetParams();
});

afterEach(() => {
  cleanup();
});

describe('Report builder (Page 21)', () => {
  it('P21-01: shows controls and a live preview', async () => {
    const { sync } = await seeded();
    await openBuilder(sync);
    expect(screen.getByTestId('builder-preview')).toBeTruthy();
    expect(screen.getByTestId('builder-show')).toBeTruthy();
    expect(screen.getByTestId('builder-group')).toBeTruthy();
    expect(screen.getByTestId('builder-split')).toBeTruthy();
    expect(screen.getByTestId('builder-chart')).toBeTruthy();
  });

  it('P21-04: asks Discard this report? when leaving dirty', async () => {
    const { sync } = await seeded();
    await openBuilder(sync);
    await act(async () => {
      fireEvent.press(screen.getAllByRole('radio', { name: t('reports.chart.donut') })[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('builder-back'));
    });
    expect(await screen.findByTestId('builder-discard')).toBeTruthy();
    expect(screen.getByText(t('reports.discardTitle'))).toBeTruthy();
  });

  it('P21-03: Save report opens PU-43 sheet', async () => {
    const { sync } = await seeded();
    await openBuilder(sync);
    fireEvent.press(screen.getByTestId('builder-save'));
    expect(await screen.findByTestId('save-report-sheet')).toBeTruthy();
    expect(screen.getByTestId('save-report-name')).toBeTruthy();
    expect(screen.getByTestId('save-report-dashboard')).toBeTruthy();
  });

  it('P21-02: opens PU-19 Filters from builder', async () => {
    const { sync } = await seeded();
    await openBuilder(sync);
    fireEvent.press(screen.getByTestId('builder-filters'));
    await waitFor(() => expect(screen.getByTestId('tx-filters-sheet')).toBeTruthy());
  });

  it('P0 #3: area chart mounts filled LineChart (see builder-preview.split + charts filled tests)', async () => {
    const { sync } = await seeded();
    await openBuilder(sync);
    await act(async () => {
      fireEvent.press(screen.getAllByRole('radio', { name: t('reports.chart.area') })[0]!);
    });
    // Empty seed has 0 series points so Path is skipped; assert area chart frame + table switch.
    expect(await screen.findByTestId('builder-preview-chart')).toBeTruthy();
    expect(screen.getByTestId('builder-preview-chart-switch')).toBeTruthy();
  });

  it('TB-14 / P1 #7: builder RangeBar is embedded (no nested range-filters)', async () => {
    const { sync } = await seeded();
    await openBuilder(sync);
    expect(screen.getByTestId('range-presets')).toBeTruthy();
    expect(screen.queryByTestId('range-filters')).toBeNull();
  });
});

