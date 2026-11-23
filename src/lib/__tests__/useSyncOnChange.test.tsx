import React, { useState } from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useSyncOnChange } from '../useSyncOnChange';

function Probe({ value }: { value: string }) {
  const [shown, setShown] = useState('');
  const [runs, setRuns] = useState(0);
  useSyncOnChange([value], () => {
    setShown(value.toUpperCase());
    setRuns((n) => n + 1);
  });
  return <Text testID="out">{`${shown}:${runs}`}</Text>;
}

describe('useSyncOnChange', () => {
  it('syncs on the first render and again only when a dependency changes', async () => {
    const view = await render(<Probe value="a" />);
    expect(view.getByTestId('out').props.children).toBe('A:1');
    await view.rerender(<Probe value="a" />);
    expect(view.getByTestId('out').props.children).toBe('A:1');
    await view.rerender(<Probe value="b" />);
    expect(view.getByTestId('out').props.children).toBe('B:2');
  });
});
