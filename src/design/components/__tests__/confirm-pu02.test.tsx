import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../../test/helpers/render';
import { t } from '@/i18n';
import { Confirm, Sheet } from '..';

describe('Confirm PU-02', () => {
  it('PU02-1 main button repeats the verb, never OK or Yes', async () => {
    await renderWithProviders(
      <Confirm
        visible
        title="Delete your account?"
        body="This can't be undone."
        confirmLabel="Delete account"
        onConfirm={() => {}}
        onCancel={() => {}}
        testID="c"
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.getByRole('button', { name: t('common.cancel') })).toBeTruthy();
  });

  it('PU02-2 Escape, backdrop and Cancel leave data alone', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(
      <Confirm visible title="Discard your changes?" body="Lost." confirmLabel="Discard changes" onConfirm={onConfirm} onCancel={onCancel} testID="c" />,
    );
    const backdrop = screen.getByTestId('c-backdrop', { includeHiddenElements: true });
    await fireEvent.press(backdrop);
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('c-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('PU02-3 destructive uses outline + ruby dot and Cancel is present for focus', async () => {
    await renderWithProviders(
      <Confirm
        visible
        destructive
        title="Delete your account?"
        body="Gone."
        confirmLabel="Delete account"
        onConfirm={() => {}}
        onCancel={() => {}}
        testID="c"
      />,
    );
    expect(screen.getByTestId('c-ruby')).toBeTruthy();
    expect(screen.getByTestId('c-cancel')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeTruthy();
  });

  it('PU00-1 Confirm is a centred dialog at most 420 wide', async () => {
    await renderWithProviders(
      <Confirm visible title="Restore this backup?" body="New workspace." confirmLabel="Restore backup" onConfirm={() => {}} onCancel={() => {}} testID="c" />,
    );
    const dialog = screen.getByTestId('c');
    expect(dialog.props.style).toEqual(expect.objectContaining({ maxWidth: 420 }));
  });

  it('PU00-6 Sheet dirty close asks before discarding', async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Sheet visible title="Edit" onClose={onClose} dirty testID="sheet">
        {null}
      </Sheet>,
    );
    await fireEvent.press(screen.getByLabelText(t('common.close'), { includeHiddenElements: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(t('common.discardTitle'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t('common.discardConfirm') }));
    expect(onClose).toHaveBeenCalled();
  });

  it('PU00-7 title and Cancel are readable; dialog is modal', async () => {
    await renderWithProviders(
      <Confirm visible title="Delete Fuel?" body="34 transactions." confirmLabel="Delete category" onConfirm={() => {}} onCancel={() => {}} testID="c" />,
    );
    expect(screen.getByRole('header', { name: 'Delete Fuel?' })).toBeTruthy();
    expect(screen.getByTestId('c')).toHaveProp('accessibilityViewIsModal', true);
    expect(screen.getByRole('button', { name: t('common.cancel') })).toBeTruthy();
  });
});
