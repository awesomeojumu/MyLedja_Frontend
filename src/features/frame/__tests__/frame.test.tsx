import { fireEvent, screen } from '@testing-library/react-native';
import { t } from '@/i18n';
import { renderWithProviders } from '../../../../test/helpers/render';
import { AppFrame } from '../AppFrame';
import { SHIPPED_PAGES } from '../navigation';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/lib/useOnline', () => ({ useOnline: () => true }));

let mockWidth = 375;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

function atWidth(width: number) {
  mockWidth = width;
}

afterEach(() => jest.restoreAllMocks());

describe('App frame (F0.6, E-09)', () => {
  it.each<[number, string]>([
    [375, 'frame-phone'],
    [800, 'frame-rail'],
    [1100, 'frame-sidebar'],
    [1500, 'frame-sidebar'],
  ])('%i px uses %s', async (width, id) => {
    atWidth(width);
    await renderWithProviders(<AppFrame title={t('dashboard.title')}>{null}</AppFrame>);
    expect(screen.getByTestId(id)).toBeTruthy();
  });

  it('phones get the bottom bar', async () => {
    atWidth(375);
    await renderWithProviders(<AppFrame title={t('dashboard.title')}>{null}</AppFrame>);
    expect(screen.getByTestId('bottom-bar')).toBeTruthy();
  });

  it('G-01 only shipped pages appear in navigation', async () => {
    atWidth(1100);
    await renderWithProviders(<AppFrame title={t('dashboard.title')}>{null}</AppFrame>);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(SHIPPED_PAGES.length);
  });

  it('the privacy toggle switches amounts off and on', async () => {
    atWidth(1100);
    await renderWithProviders(<AppFrame title={t('dashboard.title')}>{null}</AppFrame>);
    const toggle = screen.getByTestId('privacy-toggle');
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(screen.getByTestId('privacy-toggle')).toBeChecked();
  });

  it('shows the connection pill', async () => {
    atWidth(1100);
    await renderWithProviders(<AppFrame title={t('dashboard.title')}>{null}</AppFrame>);
    expect(screen.getByLabelText(t('status.synced'))).toBeTruthy();
  });
});
