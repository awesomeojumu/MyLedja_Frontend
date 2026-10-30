import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { Transport } from '@/api/client';
import type { SessionResponse } from '@/api/auth';
import { createAuthMock, DEMO } from '@/api/mocks/auth';
import { useAuth } from '@/features/auth/AuthProvider';
import { t } from '@/i18n';
import { renderWithProviders } from '../../../../test/helpers/render';
import { router } from '../../../../test/helpers/router';
import { WelcomeScreen } from '../WelcomeScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

function SignedIn({ children }: { children: React.ReactNode }) {
  const { api, completeSignIn, user } = useAuth();
  useEffect(() => {
    api.signIn({ email: DEMO.email, password: DEMO.password, staySignedIn: false }).then((r) => completeSignIn(r as SessionResponse, false));
  }, [api, completeSignIn]);
  return user ? <>{children}</> : null;
}

async function renderWelcome() {
  const mock = createAuthMock();
  mock.users.get(DEMO.email)!.setupComplete = false;
  const calls: { path: string; body: unknown }[] = [];
  const transport: Transport = async (req) => {
    calls.push({ path: req.path, body: req.body });
    return mock.transport(req);
  };
  await renderWithProviders(
    <SignedIn>
      <WelcomeScreen />
    </SignedIn>,
    { transport },
  );
  await screen.findByTestId('redesign-welcome-start');
  return calls;
}

beforeEach(() => jest.clearAllMocks());

describe('Page 04 redesign Welcome (EXPO_PUBLIC_REDESIGN on)', () => {
  it('starts with Set up MyLedja overview and Get started', async () => {
    await renderWelcome();
    expect(screen.getByText(t('welcome.redesign.startTitle'))).toBeTruthy();
    expect(screen.getByText(t('welcome.redesign.startBody'))).toBeTruthy();
    expect(screen.getByText(t('welcome.redesign.start.space'))).toBeTruthy();
    expect(screen.getByText(t('welcome.redesign.getStarted'))).toBeTruthy();
  });

  it('Get started opens space step with Personal and Just me', async () => {
    await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    expect(screen.getByTestId('redesign-welcome-space')).toBeTruthy();
    expect(screen.getByTestId('step-of')).toHaveTextContent(t('welcome.stepOf', { n: 1 }));
    expect(screen.getByTestId('workspace-name')).toHaveProp('value', t('welcome.step1.default'));
    expect(screen.getByTestId('audience-solo')).toBeSelected();
  });

  it('space → money → accounts choice → skip → categories → Finish → done → Home', async () => {
    const calls = await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue')); // start → space
    await fireEvent.press(screen.getByTestId('continue')); // → money
    expect(screen.getByTestId('redesign-welcome-money')).toBeTruthy();
    expect(screen.getByText(t('welcome.redesign.currencyNgn'))).toBeTruthy();
    expect(screen.getByTestId('week-monday')).toBeSelected();

    await fireEvent.press(screen.getByTestId('continue')); // → accounts
    expect(screen.getByTestId('redesign-welcome-accounts')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('skip'));

    expect(screen.getByTestId('redesign-welcome-categories')).toBeTruthy();
    expect(screen.getByText(t('welcome.redesign.cat.food'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('continue'));

    expect(screen.getByTestId('redesign-welcome-budget')).toBeTruthy();
    expect(screen.getByTestId('style-tracking')).toBeSelected();
    await fireEvent.press(screen.getByTestId('continue'));

    expect(await screen.findByText(t('welcome.redesign.doneTitle'))).toBeTruthy();
    expect(screen.getByText(t('welcome.redesign.doneBody'))).toBeTruthy();

    const setup = calls.find((c) => c.path.endsWith('/setup'))!.body as Record<string, unknown>;
    expect(setup.skippedSteps).toEqual([3]);
    expect(setup.accounts).toEqual([]);
    expect(setup.budgetStyle).toBe('tracking');
    expect(setup.currency).toBe('NGN');

    await fireEvent.press(screen.getByTestId('go-dashboard'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('Add manually saves an account with institution badge', async () => {
    const calls = await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('account-manual'));
    await fireEvent.press(screen.getByTestId('continue'));

    expect(screen.getByTestId('redesign-welcome-manual')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('account-name-0'), 'GTBank Current');
    expect(screen.getByTestId('institution-0')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('account-opening-0'), '412500');
    await fireEvent.press(screen.getByTestId('continue')); // Save account

    expect(screen.getByTestId('redesign-welcome-categories')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('continue'));
    await screen.findByTestId('welcome-done');

    const setup = calls.find((c) => c.path.endsWith('/setup'))!.body as Record<string, unknown>;
    expect(setup.accounts).toEqual([
      expect.objectContaining({ name: 'GTBank Current', type: 'bank', openingBalance: '41250000' }),
    ]);
  });

  it('Back from money returns to space', async () => {
    await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('back'));
    expect(screen.getByTestId('redesign-welcome-space')).toBeTruthy();
  });

  it('Plan every amount posts envelope budget style', async () => {
    const calls = await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('skip'));
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('style-envelope'));
    await fireEvent.press(screen.getByTestId('continue'));
    await screen.findByTestId('welcome-done');
    const setup = calls.find((c) => c.path.endsWith('/setup'))!.body as Record<string, unknown>;
    expect(setup.budgetStyle).toBe('envelope');
  });
});
