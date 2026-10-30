import { fireEvent, screen } from '@testing-library/react-native';
import { t } from '@/i18n';
import { renderWithProviders } from '../../../../test/helpers/render';
import { RedesignAppLockCover } from '../RedesignAppLockCover';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

describe('App lock redesign cover (Figma 6:2755)', () => {
  it('shows locked title, body, Face ID unlock and passcode', async () => {
    const onUnlock = jest.fn();
    const onPasscode = jest.fn();
    await renderWithProviders(
      <RedesignAppLockCover
        locked
        unlockLabel={t('lock.redesign.unlockFace')}
        onUnlock={onUnlock}
        onPasscode={onPasscode}
      />,
    );
    expect(screen.getByTestId('app-lock-cover')).toBeTruthy();
    expect(screen.getByText(t('lock.redesign.title'))).toBeTruthy();
    expect(screen.getByText(t('lock.redesign.body'))).toBeTruthy();
    expect(screen.getByText(t('lock.redesign.unlockFace'))).toBeTruthy();
    expect(screen.getByText(t('lock.redesign.passcode'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('app-lock-unlock'));
    expect(onUnlock).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('app-lock-passcode'));
    expect(onPasscode).toHaveBeenCalled();
  });

  it('hides unlock actions when only covering the app switcher', async () => {
    await renderWithProviders(
      <RedesignAppLockCover
        locked={false}
        unlockLabel={t('lock.redesign.unlock')}
        onUnlock={() => undefined}
        onPasscode={() => undefined}
      />,
    );
    expect(screen.getByText(t('lock.redesign.title'))).toBeTruthy();
    expect(screen.queryByTestId('app-lock-unlock')).toBeNull();
    expect(screen.queryByTestId('app-lock-passcode')).toBeNull();
  });
});
