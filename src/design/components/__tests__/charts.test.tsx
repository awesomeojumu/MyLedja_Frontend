import { fireEvent, screen, within } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { t } from '@/i18n';
import { PRIVACY_MASK } from '@/money';

import { renderWithProviders } from '../../../../test/helpers/render';
import { BarChart, DonutChart, LineChart, ProgressRing } from '..';
import tokens from '../../tokens.json';

const rows = [
  { label: 'Aug', value: 1_200_000n },
  { label: 'Sep', value: 2_000_000n, over: true },
  { label: 'Oct', value: 1_845_000n },
];
const columns: [string, string] = ['Month', 'Spent'];
const paint = (colour: string) => ({ type: 0, payload: processColor(colour) });

async function layout(testID: string) {
  const frame = screen.getByLabelText('Spending fell from September');
  await fireEvent(frame, 'layout', { nativeEvent: { layout: { width: 300, height: 160 } } });
  return screen.getByTestId(testID);
}

describe('charts', () => {
  it('names the finding and its table shows the same numbers', async () => {
    await renderWithProviders(<BarChart testID="bar" title="Spending fell from September" columns={columns} rows={rows} highlight={2} />);
    await layout('bar');
    await fireEvent.press(screen.getByRole('switch', { name: t('chart.viewAsTable') }));
    const table = screen.getByTestId('bar-table');
    expect(within(table).getByLabelText('Aug, ₦12,000.00')).toBeTruthy();
    expect(within(table).getByLabelText('Sep, ₦20,000.00')).toBeTruthy();
    expect(within(table).getByLabelText('Oct, ₦18,450.00')).toBeTruthy();
  });

  it('draws over-plan bars in ruby and at most one gold bar', async () => {
    await renderWithProviders(<BarChart testID="bar" title="Spending fell from September" columns={columns} rows={rows} highlight={2} />);
    await layout('bar');
    const fills = screen.getAllByTestId(/^chart-bar-/).map((p) => p.props.fill);
    expect(fills).toEqual([paint(tokens.color['primary-soft']), paint(tokens.color.ruby), paint(tokens.color.gold)]);
  });

  it('keeps only the last 12 bars', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ label: `m${i}`, value: BigInt(i + 1) }));
    await renderWithProviders(<BarChart testID="bar" title="Spending fell from September" columns={columns} rows={many} />);
    await layout('bar');
    expect(screen.getAllByTestId(/^chart-bar-/)).toHaveLength(12);
  });

  it('marks only the latest line point in gold', async () => {
    await renderWithProviders(<LineChart testID="line" title="Spending fell from September" columns={columns} rows={rows} />);
    await layout('line');
    expect(screen.getAllByTestId('chart-latest').map((c) => c.props.fill)).toEqual([paint(tokens.color.gold)]);
  });

  it('a donut shows at most five shares and repeats each value as text, masked with privacy on', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ label: `c${i}`, value: 100n }));
    await renderWithProviders(<DonutChart testID="donut" title="Spending fell from September" columns={columns} rows={six} total={600n} />, { privacy: true });
    await layout('donut');
    expect(screen.queryByText('c5')).toBeNull();
    expect(screen.getAllByText(PRIVACY_MASK)).toHaveLength(6);
  });

  it('a progress ring reports its value and is never gold', async () => {
    await renderWithProviders(<ProgressRing value={0.4} label="Food" />);
    expect(screen.getByRole('progressbar', { name: 'Food' }).props.accessibilityValue).toEqual({ min: 0, max: 100, now: 40 });
    expect(screen.getByTestId('ring-fill').props.stroke).not.toEqual(paint(tokens.color.gold));
  });
});
