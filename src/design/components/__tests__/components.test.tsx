import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { renderWithProviders } from '../../../../test/helpers/render';
import { t } from '@/i18n';
import { Amount, AmountInput, Banner, Button, Checkbox, CodeInput, Confirm, EmptyState, Footer, InlineError, Placeholder, StatusPill, TextInput, useToast } from '..';

describe('Amount', () => {
  it('shows naira with kobo and tabular figures', async () => {
    await renderWithProviders(<Amount minor={1845000n} testID="amt" />);
    const el = screen.getByTestId('amt');
    expect(el).toHaveTextContent('₦18,450.00');
    expect(JSON.stringify(el.props.style)).toContain('tabular-nums');
  });
  it('hides every amount in privacy mode at the same width', async () => {
    await renderWithProviders(<Amount minor={128456050n} testID="amt" />, { privacy: true });
    const el = screen.getByTestId('amt');
    expect(el.props.children.startsWith('₦ •••••')).toBe(true);
    expect(el.props.children.length).toBe('₦1,284,560.50'.length);
    expect(el).toHaveProp('accessibilityLabel', t('money.privacyLabel'));
  });
});

describe('AmountInput (A-02, G-09)', () => {
  it('reads 18450 as kobo', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<AmountInput label={t('welcome.step3.opening')} value="" onChange={onChange} testID="amount" />);
    await fireEvent.changeText(screen.getByTestId('amount'), '18450');
    expect(onChange).toHaveBeenCalledWith('18450', 1845000n);
  });
  it('refuses 1,2,3 and says why under the field', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<AmountInput label={t('welcome.step3.opening')} value="1,2,3" onChange={onChange} testID="amount" />);
    await fireEvent.changeText(screen.getByTestId('amount'), '1,2,3');
    expect(onChange).toHaveBeenCalledWith('1,2,3', null);
    await fireEvent(screen.getByTestId('amount'), 'blur');
    expect(screen.getByText(t('money.unreadable'))).toBeTruthy();
  });
});

describe('Button', () => {
  it('has a role, a label and a disabled state', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label={t('signIn.submit')} onPress={onPress} disabled />);
    const b = screen.getByRole('button', { name: t('signIn.submit') });
    expect(b).toBeDisabled();
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
  });
  it('renders a link role for text links', async () => {
    await renderWithProviders(<Button kind="link" label={t('signIn.forgot')} />);
    expect(screen.getByRole('link', { name: t('signIn.forgot') })).toBeTruthy();
  });
});

describe('Footer (E-08)', () => {
  it('accepts one main button', async () => {
    await renderWithProviders(
      <Footer>
        <Button kind="secondary" label={t('common.cancel')} />
        <Button label={t('common.continue')} />
      </Footer>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
  it('refuses two main buttons', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      renderWithProviders(
        <Footer>
          <Button label={t('common.continue')} />
          <Button kind="gradient" label={t('signIn.submit')} />
        </Footer>,
      ),
    ).rejects.toThrow('one main button');
    spy.mockRestore();
  });
});

describe('TextInput', () => {
  it('labels the field and shows its error under it', async () => {
    await renderWithProviders(<TextInput label={t('auth.email')} error={t('errors.emailInvalid')} testID="email" />);
    expect(screen.getByLabelText(t('auth.email'))).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent(t('errors.emailInvalid'));
  });
  it('lets people show a hidden password', async () => {
    await renderWithProviders(<TextInput label={t('auth.password')} secure testID="pw" />);
    expect(screen.getByTestId('pw')).toHaveProp('secureTextEntry', true);
    await fireEvent.press(screen.getByRole('button', { name: t('common.showPassword') }));
    expect(screen.getByTestId('pw')).toHaveProp('secureTextEntry', false);
  });
});

describe('CodeInput', () => {
  it('fills all six boxes from a paste', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<CodeInput value="" onChange={onChange} />);
    await fireEvent.changeText(screen.getByTestId('code-0'), '123456');
    expect(onChange).toHaveBeenCalledWith('123456');
  });
  it('labels each box for screen readers', async () => {
    await renderWithProviders(<CodeInput value="12" onChange={() => {}} />);
    expect(screen.getByLabelText(t('signUp.codeDigit', { n: 3 }))).toBeTruthy();
  });
});

describe('states (E-01 to E-03)', () => {
  it('loading shows placeholders, never ₦0.00', async () => {
    await renderWithProviders(<Placeholder />);
    expect(screen.getByTestId('placeholder', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('₦0.00')).toBeNull();
  });
  it('empty says what will appear and offers one button', async () => {
    const onAction = jest.fn();
    await renderWithProviders(<EmptyState title={t('signUp.title')} body={t('signUp.legalPending')} actionLabel={t('common.continue')} onAction={onAction} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });
  it('errors sit inline as alerts', async () => {
    await renderWithProviders(<InlineError message={t('errors.network')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(t('errors.network'));
  });
  it('banner announces offline', async () => {
    await renderWithProviders(<Banner message={t('common.offline')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(t('common.offline'));
  });
});

describe('StatusPill and Checkbox', () => {
  it('status pill reads its word', async () => {
    await renderWithProviders(<StatusPill kind="problem" label={t('status.offline')} />);
    expect(screen.getByLabelText(t('status.offline'))).toBeTruthy();
  });
  it('checkbox toggles with its state', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Checkbox label={t('signIn.stay')} checked={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox');
    expect(box).not.toBeChecked();
    await fireEvent.press(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Confirm (G-10)', () => {
  it('repeats the verb on its button and has Cancel', async () => {
    const onConfirm = jest.fn();
    await renderWithProviders(
      <Confirm visible title={t('common.discardTitle')} body={t('common.discardBody')} confirmLabel={t('common.discardConfirm')} onConfirm={onConfirm} onCancel={() => {}} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: t('common.discardConfirm') }));
    expect(onConfirm).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: t('common.cancel') })).toBeTruthy();
  });
});

describe('Toast (E-14)', () => {
  function Trigger({ undo }: { undo?: () => void }) {
    const toast = useToast();
    return <RNText onPress={() => toast.show(t('common.saved'), undo)}>{t('common.continue')}</RNText>;
  }
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a plain toast lasts 4 seconds', async () => {
    await renderWithProviders(<Trigger />);
    await fireEvent.press(screen.getByText(t('common.continue')));
    expect(screen.getByTestId('toast')).toHaveTextContent(t('common.saved'));
    await act(() => jest.advanceTimersByTime(4000));
    expect(screen.queryByTestId('toast')).toBeNull();
  });
  it('an undo toast lasts 8 seconds and undo runs', async () => {
    const undo = jest.fn();
    await renderWithProviders(<Trigger undo={undo} />);
    await fireEvent.press(screen.getByText(t('common.continue')));
    await act(() => jest.advanceTimersByTime(4000));
    await fireEvent.press(screen.getByRole('button', { name: t('common.undo') }));
    expect(undo).toHaveBeenCalled();
  });
  it('keeps at most three', async () => {
    await renderWithProviders(<Trigger />);
    for (let i = 0; i < 5; i++) await fireEvent.press(screen.getByText(t('common.continue')));
    expect(screen.getAllByTestId('toast')).toHaveLength(3);
  });
});
