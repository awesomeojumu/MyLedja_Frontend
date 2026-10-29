import { Text as RNText } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test/helpers/render';
import { MemoryKeyValue } from '@/data/kv.shared';
import { useTabParam } from '../useTabParam';
import { resetParams, router, setParams } from '../../../test/helpers/router';

jest.mock('expo-router', () => require('../../../test/helpers/router'));

const mockTabKv = new MemoryKeyValue();
jest.mock('@/data/kv', () => ({
  openKeyValue: () => mockTabKv,
  MemoryKeyValue: require('@/data/kv.shared').MemoryKeyValue,
}));

describe('useTabParam ?tab= + remembered', () => {
  beforeEach(() => {
    resetParams();
    router.setParams.mockClear();
    mockTabKv.data.clear();
  });

  function Harness() {
    const { value, setValue } = useTabParam({
      pageKey: 'account:a1',
      personId: 'u1',
      options: ['transactions', 'details'] as const,
      defaultValue: 'transactions',
    });
    return (
      <>
        <RNText testID="current">{value}</RNText>
        <RNText testID="switch" onPress={() => setValue('transactions')}>
          switch
        </RNText>
      </>
    );
  }

  it('reads ?tab= and writes it when changing', async () => {
    setParams({ tab: 'details' });
    await renderWithProviders(<Harness />);
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('details'));
    await fireEvent.press(screen.getByTestId('switch'));
    expect(router.setParams).toHaveBeenCalledWith({ tab: 'transactions' });
  });
});
