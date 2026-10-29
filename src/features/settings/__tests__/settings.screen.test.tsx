import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { exportTransactionsCsv } from '../export';
import { SettingsScreen } from '../SettingsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockWidth = 1200;
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
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Settings (F1.10)', () => {
  it('P26-02: budget style can switch', async () => {
    const { sync, repo } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-budget'));
    await fireEvent.press(screen.getByRole('radio', { name: t('settings.budget.envelope') }));
    await waitFor(async () => {
      expect((await repo.load()).settings.budgetStyle).toBe('envelope');
    });
  });

  it('P26-03: categories can be renamed', async () => {
    const { sync, repo } = await seeded();
    const market = (await repo.load()).categories.find((c) => c.name === 'Market')!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-categories'));
    await fireEvent.press(screen.getByTestId(`settings-cat-edit-${market.id}`));
    await fireEvent.changeText(screen.getByTestId('settings-edit-cat-name'), 'Groceries');
    await fireEvent.press(screen.getByText(t('panel.save')));
    await waitFor(async () => {
      expect((await repo.load()).categories.find((c) => c.id === market.id)?.name).toBe('Groceries');
    });
  });

  it('P26-04: export builds CSV rows', async () => {
    const { repo } = await seeded();
    const s = await repo.load();
    const accountId = s.accounts[0]!.id;
    const marketId = s.categories.find((c) => c.name === 'Market')!.id;
    await repo.addTransaction({
      kind: 'expense',
      accountId,
      parts: [{ categoryId: marketId, amount: 1_000_000n }],
      date: '2026-10-20',
      payeeName: 'Shoprite',
    });
    const csv = exportTransactionsCsv(await repo.load());
    expect(csv).toContain('Date,Type,Payee');
    expect(csv).toContain('Shoprite');
  });

  it('P26-06: workspace invite sheet (DESIGN page 26 popup #50)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-workspace'));
    await fireEvent.press(screen.getByTestId('settings-invite'));
    expect(screen.getByTestId('settings-invite-sheet')).toBeTruthy();
  });

  it('P26-05: notifications toggles persist', async () => {
    const { sync, repo } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-notifications'));
    expect(screen.getByTestId('settings-notifications')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-notify-bill-day-7'));
    await fireEvent(screen.getByTestId('settings-notify-bills'), 'onChange', false);
    await fireEvent.changeText(screen.getByTestId('settings-notify-quiet-start'), '21:30');
    await waitFor(async () => {
      const prefs = (await repo.load()).settings.notificationPrefs;
      expect(prefs?.bills).toBe(false);
      expect(prefs?.billReminderDays).toEqual([1, 3]);
      expect(prefs?.quietHoursStart).toBe('21:30');
    });
  });

  it('P26-07: AI features are hidden when no AI provider is set up (TECH-SPEC 2.3 rule 3)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-ai'));
    expect(await screen.findByText(t('settings.ai.unavailable'))).toBeTruthy();
    expect(screen.queryByTestId('settings-ai-statements')).toBeNull();
  });

  it('TECH-SPEC 9.9: sign-out warns when unsent outbox ops exist', async () => {
    const { sync, repo } = await seeded();
    const before = (await sync.store.outbox()).length;
    const s = await repo.load();
    await repo.addTransaction({
      kind: 'expense',
      accountId: s.accounts[0]!.id,
      parts: [{ categoryId: s.categories.find((c) => c.name === 'Market')!.id, amount: 1_000_000n }],
      date: '2026-10-20',
    });
    const waiting = (await sync.store.outbox()).filter((o) => o.state === 'queued').length;
    expect(waiting).toBeGreaterThan(before);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(await screen.findByTestId('settings-sign-out'));
    expect(await screen.findByText(t('sync.signOutWarnTitle'))).toBeTruthy();
    expect(screen.getByText(t('sync.signOutWarnBody', { count: waiting }))).toBeTruthy();
  });

  it('P26-08: exchange rate sheet saves a row', async () => {
    const { sync, repo } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-currencies'));
    await fireEvent.press(screen.getByTestId('settings-add-rate'));
    await fireEvent.changeText(screen.getByTestId('settings-exchange-rate'), '1650');
    await fireEvent.press(screen.getByText(t('settings.popup.exchangeSave')));
    await waitFor(async () => {
      expect((await repo.load()).settings.exchangeRates?.length).toBe(1);
    });
  });
});
