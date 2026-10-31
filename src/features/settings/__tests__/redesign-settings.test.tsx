import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { SettingsScreen } from '../SettingsScreen';
import { REDESIGN_SETTINGS_GROUPS } from '../redesignNav';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

let mockWidth = 375;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
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
  router.push.mockClear();
  router.back.mockClear();
});

afterEach(() => {
  mockWidth = 375;
  jest.useRealTimers();
});

describe('Page 26 redesign Settings (EXPO_PUBLIC_REDESIGN on)', () => {
  it('wide window keeps Settings inside the sidebar shell', async () => {
    mockWidth = 1100;
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('frame-sidebar')).toBeTruthy();
    expect(screen.getByTestId('redesign-settings')).toBeTruthy();
  });

  it('hub shows profile + Everyday/Safety/Your data/More with all 13 links (6:2461)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-settings')).toBeTruthy();
    expect(screen.getByTestId('settings-profile')).toBeTruthy();
    expect(screen.getByTestId('settings-group-everyday')).toBeTruthy();
    expect(screen.getByTestId('settings-group-safety')).toBeTruthy();
    expect(screen.getByTestId('settings-group-data')).toBeTruthy();
    expect(screen.getByTestId('settings-group-more')).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.groupEveryday'))).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.groupSafety'))).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.groupData'))).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.groupMore'))).toBeTruthy();
    const tabs = REDESIGN_SETTINGS_GROUPS.flatMap((g) => g.tabs);
    expect(tabs).toHaveLength(13);
    for (const id of tabs) {
      expect(screen.getByTestId(`settings-link-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('settings-version')).toBeTruthy();
  });

  it('opens General with Figma pickers and hide-amounts switch', async () => {
    const { sync } = await seeded();
    setParams({ tab: 'general' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-settings-general')).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.language'))).toBeTruthy();
    expect(screen.getByText('Nigerian naira (NGN)')).toBeTruthy();
    expect(screen.getByTestId('settings-theme')).toHaveTextContent(/Light|Match my phone/);
    expect(screen.getByTestId('settings-hide-amounts')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-date-format'));
    expect(await screen.findByTestId('settings-option-DD/MM/YYYY')).toBeTruthy();
    expect(screen.getByTestId('settings-option-MM/DD/YYYY')).toBeTruthy();
    expect(screen.getByTestId('settings-option-YYYY-MM-DD')).toBeTruthy();
  });

  it('Budget section shows Plan every amount options and warn controls', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    await repo.updateSettings({ ...snap.settings, budgetStyle: 'envelope' });
    setParams({ tab: 'budget' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-settings-budget')).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.budgetEnvelope'))).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.monthStartsDay'))).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.warnAtValue', { pct: 90 }))).toBeTruthy();
  });

  it('Categories lists seeded Market and Add a category', async () => {
    const { sync } = await seeded();
    setParams({ tab: 'categories' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-settings-categories')).toBeTruthy();
    expect(screen.getByText('Market')).toBeTruthy();
    expect(screen.getByTestId('settings-add-category')).toBeTruthy();
  });

  it('Notifications uses Figma quiet hours copy', async () => {
    const { sync } = await seeded();
    setParams({ tab: 'notifications' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-settings-notifications')).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.notifBills'))).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.quietHoursValue'))).toBeTruthy();
  });

  it('Security shows lock + Sign in rows with Figma hints', async () => {
    const { sync } = await seeded();
    setParams({ tab: 'security' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-settings-security')).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.lockApp'))).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.changePasswordHint'))).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.twoStepHint'))).toBeTruthy();
  });

  it('Advanced shows delete dialog gate and reports start copy', async () => {
    const { sync } = await seeded();
    setParams({ tab: 'advanced' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-settings-advanced')).toBeTruthy();
    expect(screen.getByText(t('settings.redesign.reportsStartValue'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-delete-all'));
    expect(await screen.findByText(t('settings.redesign.deleteTitle'))).toBeTruthy();
    expect(screen.getByTestId('settings-delete-confirm')).toBeTruthy();
  });

  it('Help lists Figma centre/support/terms rows', async () => {
    const { sync } = await seeded();
    setParams({ tab: 'help' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <SettingsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-settings-help')).toBeTruthy();
    expect(screen.getByTestId('settings-help-centre')).toBeTruthy();
    expect(screen.getByTestId('settings-privacy')).toBeTruthy();
  });
});
