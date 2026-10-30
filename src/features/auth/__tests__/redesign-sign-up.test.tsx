import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DEMO } from '@/api/mocks/auth';
import { t } from '@/i18n';
import { renderWithProviders } from '../../../../test/helpers/render';
import { router } from '../../../../test/helpers/router';
import { SignUpScreen } from '../SignUpScreen';
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

let mockOnline = true;
jest.mock('@/lib/useOnline', () => ({ useOnline: () => mockOnline }));

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  (loadGoogleSignIn as jest.Mock).mockImplementation(async () => ({ enabled: false, clientId: null }));
});

describe('Page 02 redesign Sign up (EXPO_PUBLIC_REDESIGN on)', () => {
  it('starts on details; Continue soft until name and email are valid', async () => {
    await renderWithProviders(<SignUpScreen />);
    expect(screen.getByTestId('redesign-sign-up')).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.title'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.body'))).toBeTruthy();
    expect(screen.getByTestId('name')).toBeTruthy();
    expect(screen.getByTestId('email')).toBeTruthy();
    expect(screen.queryByTestId('password')).toBeNull();
    expect(screen.getByTestId('details-continue')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('name'), 'Ama Okafor');
    expect(screen.getByTestId('details-continue')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('email'), 'ama@example.com');
    expect(screen.getByTestId('details-continue')).not.toBeDisabled();
  });

  it('Continue opens password step with Figma rules and terms line', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('name'), 'Ama Okafor');
    await fireEvent.changeText(screen.getByTestId('email'), 'ama@example.com');
    await fireEvent.press(screen.getByTestId('details-continue'));

    expect(screen.getByTestId('redesign-sign-up-password')).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.passwordTitle'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.passwordBody'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.rule.length'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.rule.mixed'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.rule.common'))).toBeTruthy();
    expect(screen.getByText(t('signUp.termsLink'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.privacyLink'))).toBeTruthy();
    expect(screen.getByTestId('create')).toBeDisabled();
  });

  it('Create account verifies email then lands on Account created → Welcome', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('name'), 'Tunde');
    await fireEvent.changeText(screen.getByTestId('email'), 'new@example.test');
    await fireEvent.press(screen.getByTestId('details-continue'));
    await fireEvent.changeText(screen.getByTestId('password'), 'lagos-rain-2026');
    expect(screen.getByTestId('create')).not.toBeDisabled();
    await fireEvent.press(screen.getByTestId('create'));

    expect(await screen.findByText(t('signUp.checkTitle'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.checkBody', { email: 'new@example.test' }))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.verify'))).toBeTruthy();
    expect(screen.getByTestId('resend-countdown')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('code-0'), DEMO.code);
    expect(await screen.findByText(t('signUp.redesign.readyTitle'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.readyBody'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ready-continue'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/welcome'));
  });

  it('Back from password returns to details without losing name or email', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('name'), 'Ama Okafor');
    await fireEvent.changeText(screen.getByTestId('email'), 'ama@example.com');
    await fireEvent.press(screen.getByTestId('details-continue'));
    await fireEvent.press(screen.getByTestId('sign-up-back'));
    expect(screen.getByTestId('redesign-sign-up')).toBeTruthy();
    expect(screen.getByTestId('name')).toHaveProp('value', 'Ama Okafor');
    expect(screen.getByTestId('email')).toHaveProp('value', 'ama@example.com');
  });

  it('Terms and Privacy Policy open the reading sheet', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('name'), 'Ama');
    await fireEvent.changeText(screen.getByTestId('email'), 'ama@example.com');
    await fireEvent.press(screen.getByTestId('details-continue'));
    await fireEvent.press(screen.getByText(t('signUp.termsLink')));
    expect(screen.getByTestId('reading-sheet')).toBeTruthy();
    expect(screen.getByTestId('reading-body')).toHaveTextContent(t('signUp.termsBody'));
    await fireEvent.press(screen.getByText(t('signUp.redesign.privacyLink')));
    expect(screen.getByTestId('reading-body')).toHaveTextContent(t('signUp.privacyBody'));
  });

  it('registered email still reaches Check your email', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('name'), 'Ada');
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.press(screen.getByTestId('details-continue'));
    await fireEvent.changeText(screen.getByTestId('password'), 'lagos-rain-2026');
    await fireEvent.press(screen.getByTestId('create'));
    expect(await screen.findByText(t('signUp.checkTitle'))).toBeTruthy();
  });

  it('Continue with Google skips the email code and goes to Welcome', async () => {
    (loadGoogleSignIn as jest.Mock).mockResolvedValue({
      enabled: true,
      clientId: 'test.apps.googleusercontent.com',
    });
    (runGoogleSignIn as jest.Mock).mockResolvedValue({
      ok: true,
      staySignedIn: false,
      session: {
        accessToken: 'access-google',
        accessTokenExpiresIn: 900,
        refreshToken: 'refresh-google',
        user: {
          id: 'user-google',
          name: 'Google User',
          email: 'google@example.test',
          setupComplete: false,
          workspaceId: 'ws-google',
          workspaceName: 'Personal',
        },
      },
    });
    await renderWithProviders(<SignUpScreen />);
    expect(await screen.findByTestId('google-sign-in')).toBeTruthy();
    expect(screen.getByText(t('auth.or'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('google-sign-in'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/welcome'));
    expect(screen.queryByText(t('signUp.checkTitle'))).toBeNull();
  });

  it('offline banner blocks Continue on details', async () => {
    mockOnline = false;
    const transport = jest.fn();
    await renderWithProviders(<SignUpScreen />, { transport });
    expect(screen.getByText(t('auth.offline'))).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('name'), 'Ama');
    await fireEvent.changeText(screen.getByTestId('email'), 'ama@example.com');
    expect(screen.getByTestId('details-continue')).toBeDisabled();
  });

  it('links Sign in from the details footer', async () => {
    await renderWithProviders(<SignUpScreen />);
    expect(screen.getByText(t('signUp.redesign.haveAccount'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: t('signUp.signIn') }));
    expect(router.push).toHaveBeenCalledWith('/sign-in');
  });
});
