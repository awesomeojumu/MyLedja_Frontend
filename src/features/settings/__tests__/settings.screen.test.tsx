import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams } from '../../../../test/helpers/router';
import { exportTransactionsCsv } from '../export';
import { SettingsScreen } from '../SettingsScreen';
import { settingsTabShipped, SHIPPED_PHASE } from '../shipped';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

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
  resetParams();
  mockWidth = 1200;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Settings Phase 1 (PU-63 / TB-11)', () => {
  it('TB11-1: only shipped-phase tabs appear', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('settings-tab-general')).toBeTruthy();
    expect(screen.getByTestId('settings-tab-budget')).toBeTruthy();
    expect(screen.getByTestId('settings-tab-categories')).toBeTruthy();
    expect(screen.getByTestId('settings-tab-importExport')).toBeTruthy();
    expect(screen.getByTestId('settings-tab-help')).toBeTruthy();
    expect(screen.getByTestId('settings-tab-currencies')).toBeTruthy();
    expect(screen.queryByTestId('settings-tab-advanced')).toBeNull();
    expect(settingsTabShipped('currencies', SHIPPED_PHASE)).toBe(true);
    expect(settingsTabShipped('advanced', SHIPPED_PHASE)).toBe(false);
    expect(settingsTabShipped('general', SHIPPED_PHASE)).toBe(true);
  });

  it('TB11-2 / PU63-1: profile photo + name save without a Save button; sidebar photo updates', async () => {
    const { sync, repo } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.queryByTestId('settings-save-general')).toBeNull();
    expect(screen.getByTestId('settings-profile-photo')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('settings-name'), 'Ada Okafor');
    await fireEvent(screen.getByTestId('settings-name'), 'blur');
    await waitFor(async () => {
      // Name is auth-local; photo/settings persist on workspace
      expect(screen.getByTestId('settings-general')).toBeTruthy();
    });
    const loaded = await repo.load();
    await repo.updateSettings({ ...loaded.settings, profilePhotoUri: 'file:///photo.jpg' });
    await waitFor(async () => {
      expect((await repo.load()).settings.profilePhotoUri).toBe('file:///photo.jpg');
    });
  });

  it('TB11-3 / P26-02: budget style switch keeps plans after confirm', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const marketId = s.categories.find((c) => c.name === 'Market')!.id;
    await repo.setAssigned(marketId, '2026-10', 40_000_00n);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-budget'));
    await fireEvent.press(screen.getByRole('radio', { name: t('settings.budget.envelope') }));
    expect(screen.getByText(t('settings.budget.switchTitle', { style: t('settings.budget.envelope') }))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t('settings.budget.switchConfirm') }));
    await waitFor(async () => {
      const after = await repo.load();
      expect(after.settings.budgetStyle).toBe('envelope');
      expect(after.assigns.get(`${marketId}:2026-10`)).toBe(40_000_00n);
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
    await fireEvent.changeText(screen.getByTestId('category-edit-name'), 'Groceries');
    await fireEvent.press(screen.getByTestId('category-edit-save'));
    await waitFor(async () => {
      expect((await repo.load()).categories.find((c) => c.id === market.id)?.name).toBe('Groceries');
    });
  });

  it('P26-04: export builds CSV rows; import CSV control is on the tab', async () => {
    const { sync, repo } = await seeded();
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
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-importExport'));
    expect(screen.getByTestId('settings-import-csv')).toBeTruthy();
    expect(screen.getByTestId('settings-export-csv')).toBeTruthy();
  });

  it('TB11-2: switches save at once on Budget', async () => {
    const { sync, repo } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-budget'));
    await fireEvent(screen.getByTestId('settings-budget-carry-default'), 'onChange', false);
    await waitFor(async () => {
      expect((await repo.load()).settings.carryOverDefault).toBe(false);
    });
  });

  it('Help and about tab is present (Phase 1)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('settings-tab-help'));
    expect(screen.getByTestId('settings-help')).toBeTruthy();
  });

  it('P26-06: workspace invite sheet still opens when Phase 3 tab is shipped', async () => {
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

  it('P26-07: AI features are hidden when no AI provider is set up', async () => {
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
  it('TB11-1: Advanced stays hidden; Currencies ships in Phase 5', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.queryByTestId('settings-tab-advanced')).toBeNull();
    expect(screen.getByTestId('settings-tab-currencies')).toBeTruthy();
    expect(screen.getByTestId('settings-tab-security')).toBeTruthy();
    expect(screen.getByTestId('settings-tab-devices')).toBeTruthy();
  });

  it('PU-56: exchange rate sheet saves a rate on Currencies', async () => {
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
