import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { t } from '@/i18n';

import { renderWithProviders } from '../../../../test/helpers/render';
import {
  BackupCodesSheet,
  ChangeEmailSheet,
  ChangePasswordSheet,
  DeleteAccountSheet,
} from '../SecuritySheets';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

describe('Security sheets (PU-53 / PU-60 / PU-61 / PU-62)', () => {
  it('PU53-2: Done stays disabled until codes are marked saved', async () => {
    await renderWithProviders(
      <BackupCodesSheet codes={['abcd-efgh-01', 'abcd-efgh-02', 'abcd-efgh-03', 'abcd-efgh-04', 'abcd-efgh-05', 'abcd-efgh-06', 'abcd-efgh-07', 'abcd-efgh-08', 'abcd-efgh-09', 'abcd-efgh-10']} onClose={jest.fn()} />,
    );
    expect(screen.getByTestId('settings-backup-codes-sheet')).toBeTruthy();
    expect(screen.getByTestId('settings-backup-columns')).toBeTruthy();
    expect(screen.getByTestId('settings-backup-done')).toBeDisabled();
    await fireEvent(screen.getByTestId('settings-backup-saved'), 'onChange', true);
    expect(screen.getByTestId('settings-backup-done')).toBeEnabled();
  });

  it('PU60: change password needs confirm match, strength, and sign-out-others', async () => {
    await renderWithProviders(<ChangePasswordSheet visible onClose={jest.fn()} guard={async (a) => a()} />);
    expect(screen.getByTestId('change-password-sheet')).toBeTruthy();
    expect(screen.getByTestId('password-strength')).toBeTruthy();
    expect(screen.getByTestId('change-password-sign-out-others')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('change-password-current'), 'old-password-1');
    await fireEvent.changeText(screen.getByTestId('change-password-new'), 'new-password-99');
    await fireEvent.changeText(screen.getByTestId('change-password-confirm'), 'mismatch');
    expect(screen.getByText(t('settings.security.passwordMismatch'))).toBeTruthy();
    expect(screen.getByTestId('change-password-save')).toBeDisabled();
  });

  it('PU61: change email sheet starts on new-email step with Send code', async () => {
    await renderWithProviders(<ChangeEmailSheet visible onClose={jest.fn()} guard={async (a) => a()} />);
    expect(screen.getByTestId('change-email-sheet')).toBeTruthy();
    expect(screen.getByTestId('change-email-send')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('change-email-new'), 'new@example.test');
    expect(screen.getByTestId('change-email-send')).toBeEnabled();
    expect(screen.getByText(t('settings.popup.emailSendCode'))).toBeTruthy();
  });

  it('PU62: delete account requires typing DELETE', async () => {
    await renderWithProviders(<DeleteAccountSheet visible onClose={jest.fn()} guard={async (a) => a()} onDeleted={async () => undefined} />);
    expect(screen.getByTestId('delete-account-sheet')).toBeTruthy();
    expect(screen.getByTestId('delete-account-continue')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('delete-account-type'), 'DELETE');
    expect(screen.getByTestId('delete-account-continue')).toBeEnabled();
  });
});
