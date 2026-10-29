import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../../test/helpers/render';
import { t } from '@/i18n';
import { Tabs, moveTabIndex } from '..';

const options = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'details', label: 'Details' },
] as const;

describe('moveTabIndex §3 keyboard', () => {
  it('moves with arrows, Home and End', () => {
    expect(moveTabIndex([...options], 'transactions', 'ArrowRight')).toBe('details');
    expect(moveTabIndex([...options], 'details', 'ArrowLeft')).toBe('transactions');
    expect(moveTabIndex([...options], 'details', 'Home')).toBe('transactions');
    expect(moveTabIndex([...options], 'transactions', 'End')).toBe('details');
  });
});

describe('Tabs §3 shared behaviour', () => {
  it('selected tab keeps its label and announces position via hint', async () => {
    await renderWithProviders(<Tabs options={[...options]} value="details" onChange={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Details' });
    expect(tab).toBeSelected();
    expect(tab).toHaveProp('accessibilityHint', t('tabs.selected', { n: 2, total: 2 }));
  });
});
