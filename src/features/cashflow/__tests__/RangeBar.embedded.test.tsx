import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '../../../../test/helpers/render';
import { RangeBar } from '../RangeBar';

jest.mock('@/design/size', () => ({
  useSizeClass: () => 'phone',
  sizeClassFor: () => 'phone',
}));

describe('RangeBar embedded (P1 #7 / TB-14)', () => {
  it('shows presets inline on phone when embedded (no nested range-filters)', async () => {
    await renderWithProviders(
      <RangeBar embedded range={{ from: '2026-10-01', to: '2026-10-29' }} onChange={() => undefined} />,
    );
    expect(screen.getByTestId('range-presets')).toBeTruthy();
    expect(screen.queryByTestId('range-filters')).toBeNull();
  });

  it('uses Filters sheet on phone when not embedded', async () => {
    await renderWithProviders(<RangeBar range={{ from: '2026-10-01', to: '2026-10-29' }} onChange={() => undefined} />);
    expect(screen.getByTestId('range-filters')).toBeTruthy();
    expect(screen.queryByTestId('range-presets')).toBeNull();
    fireEvent.press(screen.getByTestId('range-filters'));
    expect(await screen.findByTestId('range-presets')).toBeTruthy();
  });
});
