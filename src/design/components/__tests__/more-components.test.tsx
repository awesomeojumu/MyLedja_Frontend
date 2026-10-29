import { fireEvent, screen } from '@testing-library/react-native';
import { Check } from 'lucide-react-native';
import { Text as RNText } from 'react-native';
import { renderWithProviders } from '../../../../test/helpers/render';
import { t } from '@/i18n';
import { DatePicker, formatDay, GradientMesh, Icon, LogomarkLoader, Menu, Panel, Popover, SegmentedControl, Select, Switch, Tabs } from '..';
import tokens from '../../tokens.json';

const options = [
  { value: 'a', label: t('welcome.day.monday') },
  { value: 'b', label: t('welcome.day.sunday') },
] as const;

describe('Switch', () => {
  it('reports its state and flips', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Switch label={t('nav.privacyOn')} value={false} onChange={onChange} />);
    const s = screen.getByRole('switch', { name: t('nav.privacyOn') });
    expect(s).not.toBeChecked();
    await fireEvent.press(s);
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it('does nothing when disabled', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Switch label={t('nav.privacyOn')} value onChange={onChange} disabled />);
    await fireEvent.press(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Tabs and SegmentedControl', () => {
  it('tabs mark the selected tab', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Tabs options={[...options]} value="a" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: options[0].label })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: options[1].label }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
  it('segmented control is a labelled radio group', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<SegmentedControl label={t('welcome.step2.weekStart')} options={[...options]} value="b" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: options[1].label })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: options[0].label }));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});


describe('Select', () => {
  it('opens, picks and closes', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Select label={t('welcome.step2.weekStart')} options={[...options]} value="a" onChange={onChange} testID="sel" />);
    expect(screen.getByTestId('sel')).toHaveProp('accessibilityLabel', `${t('welcome.step2.weekStart')}, ${options[0].label}`);
    await fireEvent.press(screen.getByTestId('sel'));
    await fireEvent.press(screen.getByRole('radio', { name: options[1].label }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('searches and offers + Add new (PU00-2 Picker)', async () => {
    const onChange = jest.fn();
    const onAddNew = jest.fn();
    const many = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Bravo' },
      { value: 'c', label: 'Charlie' },
    ];
    await renderWithProviders(
      <Select label="Account" options={many} value="a" onChange={onChange} testID="sel" searchable addNewLabel={t('fields.addNew')} onAddNew={onAddNew} />,
    );
    await fireEvent.press(screen.getByTestId('sel'));
    await fireEvent.changeText(screen.getByTestId('sel-search'), 'bra');
    expect(screen.getByRole('radio', { name: 'Bravo' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Alpha' })).toBeNull();
    await fireEvent.press(screen.getByTestId('sel-add-new'));
    expect(onAddNew).toHaveBeenCalled();
  });
});

describe('Menu and Popover', () => {
  it('menu items run and close the menu', async () => {
    const run = jest.fn();
    await renderWithProviders(
      <Menu
        trigger={(open) => <RNText onPress={open}>{t('nav.menu')}</RNText>}
        items={[{ key: 'out', label: t('nav.signOut'), onPress: run }]}
      />,
    );
    expect(screen.queryByRole('menuitem')).toBeNull();
    await fireEvent.press(screen.getByText(t('nav.menu')));
    await fireEvent.press(screen.getByRole('menuitem', { name: t('nav.signOut') }));
    expect(run).toHaveBeenCalled();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
  it('popover renders nothing when closed', async () => {
    await renderWithProviders(<Popover visible={false} onClose={() => {}} testID="pop">{null}</Popover>);
    expect(screen.queryByTestId('pop')).toBeNull();
  });
});

describe('Panel (G-07)', () => {
  it('is a full-screen sheet with a back arrow on phones', async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Panel visible title={t('dashboard.title')} onClose={onClose} testID="panel">
        {null}
      </Panel>,
    );
    expect(screen.getByRole('header', { name: t('dashboard.title') })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t('common.back') }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('DatePicker', () => {
  it('formats days as 27 Oct 2026', () => {
    expect(formatDay('2026-10-27')).toBe('27 Oct 2026');
  });
  it('picks a day as a YYYY-MM-DD string and moves between months', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<DatePicker label={t('welcome.step3.date')} value="2026-12-31" onChange={onChange} testID="date" />);
    await fireEvent.press(screen.getByTestId('date'));
    await fireEvent.press(screen.getByRole('button', { name: t('date.nextMonth') }));
    expect(screen.getByTestId('date-month')).toHaveTextContent('Jan 2027');
    await fireEvent.press(screen.getByRole('button', { name: '2 Jan 2027' }));
    expect(onChange).toHaveBeenCalledWith('2027-01-02');
  });
});

describe('LogomarkLoader and GradientMesh', () => {
  it('loader has a plain label and no ellipsis', async () => {
    await renderWithProviders(<LogomarkLoader label={t('common.loading')} />);
    expect(screen.getByRole('progressbar', { name: t('common.loading') })).toBeTruthy();
    expect(t('common.loading')).not.toMatch(/\.\.\.|\u2026/);
  });
  it('mesh draws with SVG', async () => {
    await renderWithProviders(<GradientMesh />);
    expect(screen.getByTestId('gradient-mesh-art', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Icon (F0.4)', () => {
  it('renders a Lucide glyph at row size by default', async () => {
    await renderWithProviders(<Icon icon={Check} testID="icon-check" color={tokens.color['ink-secondary']} />);
    const el = screen.getByTestId('icon-check', { includeHiddenElements: true });
    expect(el.props.width).toBe(16);
    expect(el.props.height).toBe(16);
  });
});
