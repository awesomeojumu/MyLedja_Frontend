import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { DebtScheduleSheet } from '../DebtScheduleSheet';
import { DebtScreen } from '../DebtScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

async function seededWithDebt() {
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
  const open = await repo.openPersonDebt({
    name: 'Tunde',
    direction: 'owedToMe',
    accountId: (await repo.load()).accounts[0]!.id,
    amount: 10000000n,
    date: '2026-10-01',
  });
  return { sync, repo, debtId: open.ok ? open.value.id : 'x' };
}

describe('Debt detail (P16)', () => {
  beforeEach(() => {
    resetParams();
  });

  it('P16-04: timeline and schedule tabs', async () => {
    const { sync, debtId } = await seededWithDebt();
    setParams({ id: debtId });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('debt-detail-tabs')).toBeTruthy();
    fireEvent.press(within(screen.getByTestId('debt-detail-tabs')).getByLabelText(t('debts.scheduleTab')));
    await waitFor(() => expect(screen.getByText(t('debts.scheduleEmpty'))).toBeTruthy());
  });

  it('P16-03: send reminder button for owedToMe', async () => {
    const { sync, debtId } = await seededWithDebt();
    setParams({ id: debtId });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('debt-send-reminder')).toBeTruthy();
  });

  it('popup #36 debt schedule sheet', async () => {
    const { sync } = await seededWithDebt();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScheduleSheet debt={{ id: 'd1', name: 'T', direction: 'owedToMe', ledgerAccountId: 'x', status: 'open' }} onClose={() => {}} onSave={async () => {}} />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('debt-schedule-sheet')).toBeTruthy();
  });
});
