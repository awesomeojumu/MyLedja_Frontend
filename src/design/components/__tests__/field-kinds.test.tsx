import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../../test/helpers/render';
import { t } from '@/i18n';
import {
  AmountInput,
  DatePicker,
  NameInput,
  NotesInput,
  PercentInput,
  amountFieldError,
  dateFieldError,
  notesFieldError,
  percentFieldError,
  pickerFieldError,
  textFieldError,
} from '..';

describe('field kinds §1.1 (PU00-2)', () => {
  it('Amount: unreadable, zero, and too-large use exact words', () => {
    expect(amountFieldError('1,2,3', { required: true })).toBe(t('money.unreadable'));
    expect(amountFieldError('0', {})).toBe(t('money.zero'));
    expect(amountFieldError('0', { allowZero: true })).toBeNull();
    expect(amountFieldError('1234567890123456', {})).toBe(t('money.tooLarge'));
    expect(amountFieldError('₦18,450.00', {})).toBeNull();
  });

  it('AmountInput shows errors only after blur, not while typing', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<AmountInput label={t('welcome.step3.opening')} value="" onChange={onChange} testID="amount" required />);
    await fireEvent.changeText(screen.getByTestId('amount'), '1,2,3');
    expect(screen.queryByText(t('money.unreadable'))).toBeNull();
    await fireEvent(screen.getByTestId('amount'), 'blur');
    expect(screen.getByText(t('money.unreadable'))).toBeTruthy();
  });

  it('Text/Name: empty and too-long exact words', () => {
    expect(textFieldError('', { required: true })).toBe(t('fields.addName'));
    expect(textFieldError('', { required: true, fieldNoun: 'payee' })).toBe(t('fields.addNamed', { field: 'payee' }));
    expect(textFieldError('x'.repeat(61), {})).toBe(t('fields.tooLong'));
  });

  it('NameInput shows Add a name after blur', async () => {
    await renderWithProviders(<NameInput label={t('welcome.step3.name')} value="" onChange={() => {}} testID="name" />);
    await fireEvent(screen.getByTestId('name'), 'blur');
    expect(screen.getByText(t('fields.addName'))).toBeTruthy();
  });

  it('Notes: counter from 400 and 500-character error', async () => {
    expect(notesFieldError('x'.repeat(501))).toBe(t('fields.notesTooLong'));
    const onChange = jest.fn();
    await renderWithProviders(<NotesInput label={t('add.notes')} value={'n'.repeat(400)} onChange={onChange} testID="notes" />);
    expect(screen.getByTestId('notes-counter')).toHaveTextContent('400/500');
    await renderWithProviders(<NotesInput label={t('add.notes')} value={'n'.repeat(501)} onChange={onChange} testID="notes2" showError />);
    expect(screen.getByText(t('fields.notesTooLong'))).toBeTruthy();
  });

  it('Percent: 0 to 100 exact words', () => {
    expect(percentFieldError('101')).toBe(t('fields.percent'));
    expect(percentFieldError('12.345')).toBe(t('fields.percent'));
    expect(percentFieldError('12.5')).toBeNull();
  });

  it('PercentInput refuses over 100 after blur', async () => {
    await renderWithProviders(<PercentInput label="Rate" value="150" onChange={() => {}} testID="pct" />);
    await fireEvent(screen.getByTestId('pct'), 'blur');
    expect(screen.getByText(t('fields.percent'))).toBeTruthy();
  });

  it('Date: future day points to bills', () => {
    expect(dateFieldError('2099-01-01', { today: '2026-10-29' })).toBe(t('fields.futureDate'));
    expect(dateFieldError('2026-10-28', { today: '2026-10-29' })).toBeNull();
  });

  it('DatePicker offers Today, Yesterday and Pick chips', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<DatePicker label={t('welcome.step3.date')} value="2026-10-27" onChange={onChange} testID="date" />);
    expect(screen.getByText(t('date.today'))).toBeTruthy();
    expect(screen.getByText(t('date.yesterday'))).toBeTruthy();
    expect(screen.getByText(t('date.pick'))).toBeTruthy();
  });

  it('Picker empty uses Choose {thing}', () => {
    expect(pickerFieldError(null, 'an account')).toBe(t('fields.chooseNamed', { thing: 'an account' }));
    expect(pickerFieldError('a1', 'an account')).toBeNull();
  });
});
