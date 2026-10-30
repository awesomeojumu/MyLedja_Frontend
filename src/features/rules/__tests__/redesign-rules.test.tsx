import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { RulesScreen } from '../RulesScreen';
import { ruleIfTitle, suggestRules } from '../helpers';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

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
  const s = await repo.load();
  const accountId = s.accounts[0]!.id;
  const marketId = s.categories.find((c) => c.name === 'Market')!.id;
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 5_000_000n }],
    date: '2026-10-12',
    payeeName: 'Bolt',
  });
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 3_000_000n }],
    date: '2026-10-14',
    payeeName: 'Bolt',
  });
  await repo.createRule({
    enabled: true,
    stage: 'normal',
    matchMode: 'all',
    conditions: [{ field: 'payee', op: 'contains', value: 'Shoprite' }],
    actions: [{ kind: 'setCategory', value: marketId }],
  });
  return { sync, repo, marketId, accountId };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Page 25 redesign Rules (EXPO_PUBLIC_REDESIGN on)', () => {
  it('lists rules with Figma if/then sentences and intro (6:2315)', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    const rule = snap.rules[0]!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <RulesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-rules')).toBeTruthy();
    expect(screen.getByText(t('rules.redesign.intro'))).toBeTruthy();
    expect(screen.getByText(ruleIfTitle(rule, snap))).toBeTruthy();
    expect(screen.getByTestId(`rule-card-${rule.id}`)).toBeTruthy();
  });

  it('shows suggested banner when heuristic finds repeats', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    expect(suggestRules(snap).some((s) => s.payeeName === 'Bolt')).toBe(true);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <RulesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('rules-suggested-banner')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('rules-suggested-banner'));
    expect(await screen.findByTestId('rules-suggested')).toBeTruthy();
    expect(screen.getByText(t('rules.redesign.suggestedIntro'))).toBeTruthy();
  });

  it('opens New rule editor from plus (6:2377)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <RulesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(await screen.findByTestId('rules-new'));
    expect(await screen.findByTestId('rule-editor')).toBeTruthy();
    expect(screen.getByText(t('rules.redesign.newTitle'))).toBeTruthy();
    expect(screen.getByText(t('rules.redesign.whenTxn'))).toBeTruthy();
    expect(screen.getByTestId('rule-save')).toBeTruthy();
    // Figma Rule 6:2377 — Matches value Contains; Set value Category (not Set category).
    expect(screen.getByTestId('rule-op')).toHaveTextContent(/Contains/);
    expect(screen.getByTestId('rule-action-kind')).toHaveTextContent(/Category/);
    expect(screen.queryByText('Set category')).toBeNull();
  });

  it('saves a rule from the redesign editor', async () => {
    const { sync, repo, marketId } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <RulesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(await screen.findByTestId('rules-new'));
    await fireEvent.changeText(await screen.findByTestId('rule-value'), 'MTN');
    await fireEvent.press(screen.getByTestId('rule-action-value'));
    await fireEvent.press(await screen.findByTestId(`rule-option-${marketId}`));
    await fireEvent.press(screen.getByTestId('rule-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(after.rules.some((r) => r.conditions[0]?.value === 'MTN')).toBe(true);
    });
  });

  it('empty state matches Figma 13:6390', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'Cash', type: 'cash', openingBalance: '0', openingDate: '2026-10-01' }],
      categories: [],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <RulesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('rules-empty')).toBeTruthy();
    expect(screen.getByText(t('rules.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('rules.redesign.emptyBody'))).toBeTruthy();
  });
});
