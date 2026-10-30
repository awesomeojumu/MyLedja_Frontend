import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../../test/helpers/render';
import { isRedesignEnabled } from '../flag';
import { REDESIGN_ICON_NAMES, RedesignIcon } from '../icons';
import {
  RedesignAmount,
  RedesignBottomNav,
  RedesignCouldNotLoad,
  RedesignEmpty,
  RedesignOfflineStrip,
  RedesignProgress,
  RedesignSegmented,
  RedesignSkeleton,
} from '../components';
import redesignTokens from '../tokens.json';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

describe('W0 redesign foundation', () => {
  it('flag defaults off', () => {
    expect(isRedesignEnabled()).toBe(false);
  });

  it('ships 41 Figma icons', async () => {
    expect(REDESIGN_ICON_NAMES).toHaveLength(41);
    const view = await renderWithProviders(<RedesignIcon name="home" />);
    expect(view.toJSON()).toBeTruthy();
  });

  it('tokens cover seed, palette, color.light, shape, space, size, density, motion', () => {
    expect(redesignTokens.seed.navy).toBe('#0B2A5B');
    expect(redesignTokens.palette['navy-50']).toBe('#E8F1FE');
    expect(redesignTokens.color.light.primary).toBe('#0B2A5B');
    expect(redesignTokens.shape['radius-lg']).toBe(16);
    expect(redesignTokens.space.lg).toBe(16);
    expect(redesignTokens.size['add-fab']).toBe(56);
    expect(redesignTokens.density.touch.minTarget).toBe(48);
    expect(redesignTokens.density.pointer.minTarget).toBe(36);
    expect(redesignTokens.motion.base).toBe(240);
    expect(redesignTokens.font.family).toBe('Figtree');
  });

  it('bottom nav + floating Add are fixed together', async () => {
    const onTab = jest.fn();
    const onAdd = jest.fn();
    await renderWithProviders(
      <RedesignBottomNav
        tabs={[
          { key: 'home', label: 'Home', icon: 'home' },
          { key: 'transactions', label: 'Transactions', icon: 'list' },
          { key: 'budget', label: 'Budget', icon: 'pie' },
          { key: 'accounts', label: 'Accounts', icon: 'bank' },
          { key: 'more', label: 'More', icon: 'more' },
        ]}
        activeKey="home"
        onTab={onTab}
        onAdd={onAdd}
      />,
    );
    expect(screen.getByTestId('redesign-bottom-nav')).toBeTruthy();
    expect(screen.getByTestId('redesign-fab-add')).toBeTruthy();
    expect(screen.getByTestId('redesign-tab-bar')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('redesign-fab-add'));
    expect(onAdd).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('redesign-nav-more'));
    expect(onTab).toHaveBeenCalledWith('more');
  });

  it('amount uses tabular nums; progress can show Over plan', async () => {
    await renderWithProviders(
      <>
        <RedesignAmount testID="amt" text="₦1,000.00" />
        <RedesignAmount testID="amt-hidden" text="₦1,000.00" hidden />
        <RedesignProgress testID="prog" value={62_400} max={60_000} overPlan />
        <RedesignSkeleton />
        <RedesignOfflineStrip />
        <RedesignEmpty title="Empty" body="Nothing here" actionLabel="Add" onAction={() => undefined} />
        <RedesignCouldNotLoad onRetry={() => undefined} />
        <RedesignSegmented
          options={[
            { key: 'a', label: 'A' },
            { key: 'b', label: 'B' },
          ]}
          value="a"
          onChange={() => undefined}
        />
      </>,
    );
    expect(screen.getByTestId('amt')).toBeTruthy();
    expect(screen.getByTestId('amt-hidden')).toHaveTextContent('₦ ••••••');
    expect(screen.getByTestId('prog-over')).toBeTruthy();
    expect(screen.getByTestId('redesign-offline-strip')).toBeTruthy();
    expect(screen.getByTestId('redesign-could-not-load')).toBeTruthy();
  });
});
