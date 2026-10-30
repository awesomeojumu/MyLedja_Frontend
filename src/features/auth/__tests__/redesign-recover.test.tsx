import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DEMO } from '@/api/mocks/auth';
import { t } from '@/i18n';
import { renderWithProviders } from '../../../../test/helpers/render';
import { router } from '../../../../test/helpers/router';
import { RecoverScreen } from '../RecoverScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

let mockOnline = true;
jest.mock('@/lib/useOnline', () => ({ useOnline: () => mockOnline }));

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
});

describe('Page 03 redesign Recover (EXPO_PUBLIC_REDESIGN on)', () => {
  it('starts on email; Send code soft until email is valid', async () => {
    await renderWithProviders(<RecoverScreen />);
    expect(screen.getByTestId('redesign-recover')).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.title'))).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.body'))).toBeTruthy();
    expect(screen.getByTestId('email')).toBeTruthy();
    expect(screen.queryByTestId('code-0')).toBeNull();
    expect(screen.getByTestId('send-code')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('email'), 'ama@example.com');
    expect(screen.getByTestId('send-code')).not.toBeDisabled();
  });

  it('Send code opens Check your email with Figma body and Resend', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.press(screen.getByTestId('send-code'));

    expect(await screen.findByTestId('redesign-recover-code')).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.checkTitle'))).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.checkBody', { email: DEMO.email }))).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.verify'))).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.resend'))).toBeTruthy();
    expect(screen.getByTestId('resend-countdown')).toBeTruthy();
    expect(screen.getByTestId('verify-code')).toBeDisabled();
  });

  it('answers the same for known and unknown emails (enumeration-safe)', async () => {
    for (const email of ['nobody@example.test', DEMO.email]) {
      await renderWithProviders(<RecoverScreen />);
      await fireEvent.changeText(screen.getByTestId('email'), email);
      await fireEvent.press(screen.getByTestId('send-code'));
      expect(await screen.findByText(t('recover.redesign.checkBody', { email }))).toBeTruthy();
    }
  });

  it('Verify code opens new password with Figma rules; Save lands on done → Sign in', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.press(screen.getByTestId('send-code'));
    await screen.findByTestId('redesign-recover-code');

    await fireEvent.changeText(screen.getByTestId('code-0'), DEMO.code);
    expect(await screen.findByTestId('redesign-recover-password')).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.passwordTitle'))).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.passwordBody'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.rule.length'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.rule.mixed'))).toBeTruthy();
    expect(screen.getByText(t('signUp.redesign.rule.common'))).toBeTruthy();
    expect(screen.getByTestId('save-password')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('new-password'), 'short');
    expect(screen.getByTestId('save-password')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('new-password'), 'new-lagos-pass-1');
    expect(screen.getByTestId('save-password')).not.toBeDisabled();
    await fireEvent.press(screen.getByTestId('save-password'));

    expect(await screen.findByText(t('recover.redesign.doneTitle'))).toBeTruthy();
    expect(screen.getByText(t('recover.redesign.doneBody'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('to-sign-in'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('Back from code returns to email without losing the address', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), 'ama@example.com');
    await fireEvent.press(screen.getByTestId('send-code'));
    await screen.findByTestId('redesign-recover-code');
    await fireEvent.press(screen.getByTestId('recover-back'));
    expect(screen.getByTestId('redesign-recover')).toBeTruthy();
    expect(screen.getByTestId('email')).toHaveProp('value', 'ama@example.com');
  });

  it('Back on email goes to Sign in', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.press(screen.getByTestId('recover-back'));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('web Enter submits the email step', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent(screen.getByTestId('email'), 'submitEditing');
    expect(await screen.findByTestId('redesign-recover-code')).toBeTruthy();
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

  it('invalid code on save returns to the code step', async () => {
    await renderWithProviders(<RecoverScreen />);
    await fireEvent.changeText(screen.getByTestId('email'), DEMO.email);
    await fireEvent.press(screen.getByTestId('send-code'));
    await screen.findByTestId('redesign-recover-code');
    await fireEvent.changeText(screen.getByTestId('code-0'), '000000');
    await screen.findByTestId('redesign-recover-password');
    await fireEvent.changeText(screen.getByTestId('new-password'), 'new-lagos-pass-1');
    await fireEvent.press(screen.getByTestId('save-password'));
    expect(await screen.findByTestId('redesign-recover-code')).toBeTruthy();
    expect(await screen.findByText(t('errors.codeInvalid'))).toBeTruthy();
  });
});
