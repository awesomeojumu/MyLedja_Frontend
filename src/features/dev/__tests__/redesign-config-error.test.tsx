import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { t } from '@/i18n';
import { renderWithProviders } from '../../../../test/helpers/render';
import { ConfigErrorScreen } from '../ConfigErrorScreen';
import { RedesignConfigErrorScreen } from '../RedesignConfigErrorScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

describe('Config error redesign (Figma 6:2771)', () => {
  it('shows Figma title, body, missing names, Try again and Contact support', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await renderWithProviders(<ConfigErrorScreen problems={['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_FOO']} />);
    expect(screen.getByTestId('config-error')).toBeTruthy();
    expect(screen.getByText(t('dev.redesign.configTitle'))).toBeTruthy();
    expect(screen.getByText(t('dev.redesign.configBody'))).toBeTruthy();
    expect(screen.getByTestId('config-error-names')).toHaveTextContent(
      t('dev.redesign.configNames', { names: 'EXPO_PUBLIC_API_URL, EXPO_PUBLIC_FOO' }),
    );
    expect(screen.getByText(t('dev.redesign.tryAgain'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('config-error-support'));
    expect(openURL).toHaveBeenCalledWith('mailto:support@myledja.com');
    openURL.mockRestore();
  });

  it('omits the missing-names caption when the list is empty', async () => {
    await renderWithProviders(<RedesignConfigErrorScreen problems={[]} />);
    expect(screen.getByText(t('dev.redesign.configTitle'))).toBeTruthy();
    expect(screen.queryByTestId('config-error-names')).toBeNull();
  });
});
