import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { createAuthMock, DEMO } from '@/api/mocks/auth';
import { t } from '@/i18n';
import { renderWithProviders } from '../../../../test/helpers/render';
import { router } from '../../../../test/helpers/router';
import { RecoverScreen } from '../RecoverScreen';
import { SignInScreen } from '../SignInScreen';
import { SignUpScreen } from '../SignUpScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockOnline = true;
jest.mock('@/lib/useOnline', () => ({ useOnline: () => mockOnline }));

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
});

async function signIn(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('email'), email);
  await fireEvent.changeText(screen.getByTestId('password'), password);
  await fireEvent.press(screen.getByTestId('sign-in'));
}

describe('P01 Sign in', () => {
  it('P01-01 signs in and lands on the Dashboard', async () => {
    await renderWithProviders(<SignInScreen />);
    await signIn(DEMO.email, DEMO.password);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('P01-01 lands on Welcome when setup is unfinished', async () => {
    const mock = createAuthMock();
    mock.users.get(DEMO.email)!.setupComplete = false;
    await renderWithProviders(<SignInScreen />, { transport: mock.transport });
    await signIn(DEMO.email, DEMO.password);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/welcome'));
  });

  it('P01-02 never says which detail is wrong, then asks to wait after five tries', async () => {
    let now = 1_000_000;
    await renderWithProviders(<SignInScreen now={() => now} />);
    await signIn('nobody@example.test', 'whatever-123');
    expect(await screen.findByText(t('signIn.wrong'))).toBeTruthy();
    for (let i = 0; i < 5; i++) await signIn(DEMO.email, 'wrong-password-1');
    expect(await screen.findByText(t('signIn.wait'))).toBeTruthy();
    expect(screen.getByText(t('signIn.waitCountdown', { seconds: 60 }))).toBeTruthy();
    expect(screen.getByTestId('sign-in')).toBeDisabled();
    now += 61_000;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    expect(screen.getByTestId('sign-in')).not.toBeDisabled();
  });

  it('P01-08 links to Recover and Sign up', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole('link', { name: t('signIn.forgot') }));
    expect(router.push).toHaveBeenCalledWith('/recover');
    await fireEvent.press(screen.getByRole('link', { name: t('signIn.createOne') }));
    expect(router.push).toHaveBeenCalledWith('/sign-up');
  });

  it('P01-09 offline: says a connection is needed and sends nothing', async () => {
    mockOnline = false;
    const transport = jest.fn();
    await renderWithProviders(<SignInScreen />, { transport });
    expect(screen.getByText(t('auth.offline'))).toBeTruthy();
    await signIn(DEMO.email, DEMO.password);
    expect(screen.getByTestId('sign-in')).toBeDisabled();
    expect(transport.mock.calls.filter(([req]) => req.path === '/v1/auth/sign-in')).toHaveLength(0);
  });

  it('P01-04 the stay-signed-in box is web only and carries its warning', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText(t('signIn.stay'))).toBeTruthy();
    expect(screen.getByText(t('signIn.stayCaption'))).toBeTruthy();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  });

  it('P01-04 phones never show the box', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByText(t('signIn.stay'))).toBeNull();
  });
});

describe('P02 Sign up', () => {
  async function fillCreate(email = 'new@example.test') {
    await fireEvent.changeText(screen.getByTestId('name'), 'Tunde');
    await fireEvent.changeText(screen.getByTestId('email'), email);
    await fireEvent.changeText(screen.getByTestId('password'), 'lagos-rain-2026');
  }

  it('P02-01 the strength bar and ticked rules follow the password', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('password'), 'password');
    expect(screen.getByText(t('signUp.strengthLabel', { level: t('signUp.strength.weak') }))).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('password'), 'lagos-rain-2026');
    expect(screen.getByText(t('signUp.strengthLabel', { level: t('signUp.strength.strong') }))).toBeTruthy();
  });

  it('P02-02 refuses to continue without the terms, and opens them in a reading sheet', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fillCreate();
    await fireEvent.press(screen.getByTestId('create'));
    expect(await screen.findByText(t('errors.termsRequired'))).toBeTruthy();
    await fireEvent.press(screen.getByText(t('signUp.termsLink')));
    expect(screen.getByTestId('reading-sheet')).toBeTruthy();
    expect(screen.getByTestId('name')).toHaveProp('value', 'Tunde');
  });

  it('P02-03 and P02-06: code step, then ready, then Welcome', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fillCreate();
    await fireEvent.press(screen.getByTestId('terms'));
    await fireEvent.press(screen.getByTestId('create'));
    expect(await screen.findByText(t('signUp.checkTitle'))).toBeTruthy();
    expect(screen.getByText(t('signUp.checkBody', { email: 'new@example.test' }))).toBeTruthy();
    expect(screen.getByTestId('resend-countdown')).toHaveTextContent(t('signUp.resendIn', { seconds: '45' }));
    await fireEvent.changeText(screen.getByTestId('code-0'), DEMO.code);
    await fireEvent.press(screen.getByTestId('verify'));
    expect(await screen.findByText(t('signUp.readyTitle'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ready-continue'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/welcome'));
  });

  it('P02-03 "Wrong email? Change it" goes back', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fillCreate();
    await fireEvent.press(screen.getByTestId('terms'));
    await fireEvent.press(screen.getByTestId('create'));
    await fireEvent.press(await screen.findByText(t('signUp.changeEmail')));
    expect(screen.getByTestId('email')).toHaveProp('value', 'new@example.test');
  });

  it('P02-04 a registered email still sees "Check your email"', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fillCreate(DEMO.email);
    await fireEvent.press(screen.getByTestId('terms'));
    await fireEvent.press(screen.getByTestId('create'));
    expect(await screen.findByText(t('signUp.checkTitle'))).toBeTruthy();
  });
});

describe('P03 Recover account', () => {
  it.each(['nobody@example.test', DEMO.email])('P03-01 answers the same for %s', async (email) => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), email);
    await fireEvent.press(screen.getByTestId('send-code'));
    expect(await screen.findByText(t('recover.sent'))).toBeTruthy();
  });

  it('P03-02 and P03-03 set a strong new password and see the signed-out note', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.press(screen.getByTestId('send-code'));
    await screen.findByText(t('recover.sent'));
    await fireEvent.changeText(screen.getByTestId('code-0'), DEMO.code);
    await fireEvent.changeText(screen.getByTestId('new-password'), 'short');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'short');
    await fireEvent.press(screen.getByTestId('save-password'));
    expect(await screen.findByText(t('errors.passwordWeak'))).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('new-password'), 'new-lagos-pass-1');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'new-lagos-pass-1');
    await fireEvent.press(screen.getByTestId('save-password'));
    expect(await screen.findByText(t('recover.doneTitle'))).toBeTruthy();
  });

  it('web Enter submits the email step', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent(screen.getByTestId('email'), 'submitEditing');
    expect(await screen.findByText(t('recover.sent'))).toBeTruthy();
  });

  it('web Enter on confirm submits the reset step', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.press(screen.getByTestId('send-code'));
    await screen.findByText(t('recover.sent'));
    await fireEvent.changeText(screen.getByTestId('code-0'), DEMO.code);
    await fireEvent.changeText(screen.getByTestId('new-password'), 'new-lagos-pass-1');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'new-lagos-pass-1');
    await fireEvent(screen.getByTestId('confirm-password'), 'submitEditing');
    expect(await screen.findByText(t('recover.doneTitle'))).toBeTruthy();
  });

  it('shows wait copy and countdown on recover 429', async () => {
    let now = 1_000_000;
    const transport = jest.fn(async () => ({
      status: 429,
      body: { code: 'too_many_attempts', message: t('signIn.wait'), retryAfterSeconds: 60 },
    }));
    await renderWithProviders(<RecoverScreen now={() => now} />, { transport });
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.press(screen.getByTestId('send-code'));
    expect(await screen.findByText(t('signIn.wait'))).toBeTruthy();
    expect(screen.getByText(t('signIn.waitCountdown', { seconds: 60 }))).toBeTruthy();
    expect(screen.getByTestId('send-code')).toBeDisabled();
    now += 61_000;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    expect(screen.getByTestId('send-code')).not.toBeDisabled();
  });
});
