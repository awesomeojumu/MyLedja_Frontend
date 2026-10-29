import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import type { Transport } from '@/api/client';
import type { SessionResponse } from '@/api/auth';
import { createAuthMock, DEMO } from '@/api/mocks/auth';
import { t } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { renderWithProviders } from '../../../../test/helpers/render';
import { router } from '../../../../test/helpers/router';
import { WelcomeScreen } from '../WelcomeScreen';
import { useEffect } from 'react';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

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
  await screen.findByTestId('step-of');
  return calls;
}

beforeEach(() => jest.clearAllMocks());

describe('P04 Welcome', () => {
  it('P04-01 shows "Step n of 5" and Back returns to the previous step', async () => {
    await renderWelcome();
    expect(screen.getByTestId('step-of')).toHaveTextContent(t('welcome.stepOf', { n: 1 }));
    await fireEvent.press(screen.getByTestId('continue'));
    expect(screen.getByTestId('step-of')).toHaveTextContent(t('welcome.stepOf', { n: 2 }));
    await fireEvent.press(screen.getByTestId('back'));
    expect(screen.getByTestId('step-of')).toHaveTextContent(t('welcome.stepOf', { n: 1 }));
  });

  it('P04-01 Android back goes to the previous step, not out of setup', async () => {
    const listeners: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, fn) => {
      listeners.push(fn as () => boolean);
      return { remove: () => {} };
    });
    await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    const handled = listeners[listeners.length - 1]!();
    expect(handled).toBe(true);
    await waitFor(() => expect(screen.getByTestId('step-of')).toHaveTextContent(t('welcome.stepOf', { n: 1 })));
    spy.mockRestore();
  });

  it('P04-03 step 1 asks only for a name with Personal filled in', async () => {
    await renderWelcome();
    expect(screen.getByTestId('workspace-name')).toHaveProp('value', t('welcome.step1.default'));
  });

  it('P04-04 step 2 has naira chosen and asks for the first day of the week', async () => {
    await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    expect(screen.getByText(t('welcome.step2.ngn'))).toBeTruthy();
    expect(screen.getByTestId('week-monday')).toBeChecked();
  });

  it('P04-05 shows a bank badge when the account name matches', async () => {
    await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.changeText(screen.getByTestId('account-name-0'), 'GTBank Current');
    expect(screen.getByTestId('institution-0')).toBeTruthy();
    expect(screen.getByText('GTBank')).toBeTruthy();
  });

  it('P04-02, P04-05 to P04-08: accounts, categories, style, then "You\'re set up"', async () => {
    const calls = await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('skip'));
    await fireEvent.changeText(screen.getByTestId('account-name-0'), 'GTBank Current');
    await fireEvent.changeText(screen.getByTestId('account-opening-0'), '812,300');
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('category-cat.okada'));
    expect(screen.getByTestId('category-cat.okada')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('continue'));
    expect(screen.getByText(t('welcome.step5.limitsBadge'))).toBeTruthy();
    expect(screen.getByTestId('style-tracking')).toBeSelected();
    await fireEvent.press(screen.getByTestId('continue'));
    expect(await screen.findByText(t('welcome.done.title'))).toBeTruthy();
    expect(screen.getByText(t('welcome.done.add'))).toBeTruthy();

    const setup = calls.find((c) => c.path.endsWith('/setup'))!.body as Record<string, unknown>;
    expect(setup.skippedSteps).toEqual([2]);
    expect(setup.accounts).toEqual([
      expect.objectContaining({ name: 'GTBank Current', type: 'bank', openingBalance: '81230000' }),
    ]);
    expect((setup.categories as { key: string }[]).map((c) => c.key)).not.toContain('cat.okada');
    expect(setup.budgetStyle).toBe('tracking');

    await fireEvent.press(screen.getByTestId('go-dashboard'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('G-09 Continue stays disabled while an opening balance can\'t be read', async () => {
    await renderWelcome();
    await fireEvent.press(screen.getByTestId('continue'));
    await fireEvent.press(screen.getByTestId('continue'));
    const opening = screen.getByTestId('account-opening-0');
    await fireEvent.changeText(opening, '1,2,3');
    await fireEvent(opening, 'blur');
    expect(screen.getByTestId('continue')).toBeDisabled();
    expect(screen.getByText(t('money.unreadable'))).toBeTruthy();
  });
});
