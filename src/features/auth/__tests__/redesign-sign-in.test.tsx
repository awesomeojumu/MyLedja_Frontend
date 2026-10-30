import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { createAuthMock, DEMO } from '@/api/mocks/auth';
import { t } from '@/i18n';
import { renderWithProviders } from '../../../../test/helpers/render';
import { router } from '../../../../test/helpers/router';
import { SignInScreen } from '../SignInScreen';
import { loadGoogleSignIn, runGoogleSignIn } from '../googleSignIn';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));
jest.mock('../googleSignIn', () => {
  const actual = jest.requireActual('../googleSignIn');
  return {
    ...actual,
    loadGoogleSignIn: jest.fn(actual.loadGoogleSignIn),
    runGoogleSignIn: jest.fn(actual.runGoogleSignIn),
  };
});

const mockPasskeysAvailable = jest.fn(() => false);
jest.mock('../passkey', () => ({
  passkeysAvailable: () => mockPasskeysAvailable(),
  passkeyAssertion: jest.fn(),
  passkeyRegistration: jest.fn(),
}));

let mockOnline = true;
jest.mock('@/lib/useOnline', () => ({ useOnline: () => mockOnline }));

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  mockPasskeysAvailable.mockReturnValue(false);
  (loadGoogleSignIn as jest.Mock).mockImplementation(async () => ({ enabled: false, clientId: null }));
});

describe('Page 01 redesign Sign in (EXPO_PUBLIC_REDESIGN on)', () => {
  it('starts with email only; password then Continue appear progressively', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByTestId('redesign-sign-in')).toBeTruthy();
    expect(screen.getByText(t('signIn.redesign.title'))).toBeTruthy();
    expect(screen.getByText(t('signIn.redesign.body'))).toBeTruthy();
    expect(screen.getByTestId('email')).toBeTruthy();
    expect(screen.queryByTestId('password')).toBeNull();
    expect(screen.queryByTestId('sign-in')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    expect(screen.getByTestId('password')).toBeTruthy();
    expect(screen.queryByTestId('sign-in')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('password'), DEMO.password);
    expect(screen.getByTestId('sign-in')).toBeTruthy();
    expect(screen.getByText(t('common.continue'))).toBeTruthy();
  });

  it('Continue signs in and lands on the Dashboard', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.changeText(screen.getByTestId('password'), DEMO.password);
    await fireEvent.press(screen.getByTestId('sign-in'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('shows Figma wrong-password copy on the password field', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.changeText(screen.getByTestId('password'), 'wrong-password-1');
    await fireEvent.press(screen.getByTestId('sign-in'));
    expect(await screen.findByText(t('signIn.redesign.wrong'))).toBeTruthy();
  });

  it('links Forgot password and Create an account', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.press(screen.getByRole('link', { name: t('signIn.redesign.forgot') }));
    expect(router.push).toHaveBeenCalledWith('/recover');
    await fireEvent.press(screen.getByRole('link', { name: t('signIn.redesign.createOne') }));
    expect(router.push).toHaveBeenCalledWith('/sign-up');
  });

  it('offline banner blocks Continue', async () => {
    mockOnline = false;
    const transport = jest.fn();
    await renderWithProviders(<SignInScreen />, { transport });
    expect(screen.getByText(t('auth.offline'))).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.changeText(screen.getByTestId('password'), DEMO.password);
    expect(screen.getByTestId('sign-in')).toBeDisabled();
    expect(transport.mock.calls.filter(([req]) => req.path === '/v1/auth/sign-in')).toHaveLength(0);
  });

  it('two-factor step matches Figma code frame copy', async () => {
    const mock = createAuthMock();
    mock.users.get(DEMO.email)!.twoFactor = true;
    await renderWithProviders(<SignInScreen />, { transport: mock.transport });
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.changeText(screen.getByTestId('password'), DEMO.password);
    await fireEvent.press(screen.getByTestId('sign-in'));
    expect(await screen.findByText(t('signIn.redesign.codeTitle'))).toBeTruthy();
    expect(screen.getByText(t('signIn.redesign.codeBody'))).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('two-factor-code-0'), '123456');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('web Stay signed in remains available after password appears', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByText(t('signIn.stay'))).toBeNull();
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    expect(screen.getByText(t('signIn.stay'))).toBeTruthy();
    expect(screen.getByText(t('signIn.redesign.stayCaption'))).toBeTruthy();
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  });

  it('Google button sits below the divider when enabled', async () => {
    (loadGoogleSignIn as jest.Mock).mockResolvedValue({
      enabled: true,
      clientId: 'test.apps.googleusercontent.com',
    });
    (runGoogleSignIn as jest.Mock).mockResolvedValue({ ok: false, reason: 'cancelled' });
    await renderWithProviders(<SignInScreen />);
    expect(await screen.findByTestId('google-sign-in')).toBeTruthy();
    expect(screen.getByText(t('auth.or'))).toBeTruthy();
  });

  it('lockout still disables Continue after five wrong tries', async () => {
    let now = 1_000_000;
    await renderWithProviders(<SignInScreen now={() => now} />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    for (let i = 0; i < 5; i++) {
      await fireEvent.changeText(screen.getByTestId('password'), 'wrong-password-1');
      await fireEvent.press(screen.getByTestId('sign-in'));
    }
    expect(await screen.findByText(t('signIn.wait'))).toBeTruthy();
    expect(screen.getByTestId('sign-in')).toBeDisabled();
    now += 61_000;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    expect(screen.getByTestId('sign-in')).not.toBeDisabled();
  });
});
