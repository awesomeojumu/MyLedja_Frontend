import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { t } from '@/i18n';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import { useSizeClass } from '../size';
import { Button } from './Button';
import { Footer } from './primitives';
import { Text } from './Text';

// brand-dark-900 at 45% (DESIGN.md 4).
const backdrop = `${tokens.color['brand-dark-900']}73`;

/** A bottom sheet on phones and a centred dialog elsewhere (DESIGN.md 4). Supports dirty discard (PU00-6). */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
  width = 480,
  testID,
  dirty = false,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  testID?: string;
  /** When true, closing asks Discard your changes? (PU00-6 / PU-02). */
  dirty?: boolean;
}) {
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  const [discard, setDiscard] = useState(false);

  useEffect(() => {
    if (!visible) setDiscard(false);
  }, [visible]);

  const requestClose = () => {
    if (dirty) setDiscard(true);
    else onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType={phone ? 'slide' : 'fade'} onRequestClose={requestClose} aria-label={title}>
        <View style={{ flex: 1, backgroundColor: backdrop, justifyContent: phone ? 'flex-end' : 'center', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={requestClose} style={{ position: 'absolute', inset: 0 }} />
          <View
            testID={testID}
            accessibilityViewIsModal
            style={{
              backgroundColor: theme.card,
              width: phone ? '100%' : width,
              maxWidth: '100%',
              maxHeight: phone ? '92%' : '90%',
              borderRadius: tokens.radius['rounded-lg'],
              borderBottomLeftRadius: phone ? 0 : tokens.radius['rounded-lg'],
              borderBottomRightRadius: phone ? 0 : tokens.radius['rounded-lg'],
              borderTopLeftRadius: phone ? tokens.radius['rounded-xl'] : tokens.radius['rounded-lg'],
              borderTopRightRadius: phone ? tokens.radius['rounded-xl'] : tokens.radius['rounded-lg'],
              padding: tokens.spacing['spacing-xl'],
              gap: tokens.spacing['spacing-lg'],
              boxShadow: tokens.elevation['elevation-2'],
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="heading-md" accessibilityRole="header">
                {title}
              </Text>
              {phone ? null : <Button kind="link" label={t('common.close')} onPress={requestClose} />}
            </View>
            <ScrollView>{children}</ScrollView>
            {footer}
          </View>
        </View>
      </Modal>
      <Confirm
        visible={discard}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          setDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

/**
 * PU-02 Confirm: centred dialog on every size, ≤420 wide.
 * Escape, backdrop and Cancel leave data alone. Destructive focuses Cancel and uses an outline + ruby dot.
 */
export function Confirm({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = false,
  testID,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Deleting an account/workspace or restoring a backup. */
  destructive?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const cancelRef = useRef<ComponentRef<typeof Button>>(null);

  useEffect(() => {
    if (!visible || !destructive) return;
    // Web: put keyboard focus on Cancel so Enter does nothing harmful (PU02-3).
    const node = cancelRef.current as unknown as { focus?: () => void } | null;
    const id = requestAnimationFrame(() => node?.focus?.());
    return () => cancelAnimationFrame(id);
  }, [visible, destructive]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} aria-label={title}>
      <View style={{ flex: 1, backgroundColor: backdrop, justifyContent: 'center', alignItems: 'center', padding: tokens.spacing['spacing-lg'] }}>
        <Pressable
          testID={testID ? `${testID}-backdrop` : 'confirm-backdrop'}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={onCancel}
          style={{ position: 'absolute', inset: 0 }}
        />
        <View
          testID={testID ?? 'confirm'}
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{
            backgroundColor: theme.card,
            width: '100%',
            maxWidth: tokens.width.confirm,
            borderRadius: tokens.radius['rounded-lg'],
            padding: tokens.spacing['spacing-xl'],
            gap: tokens.spacing['spacing-lg'],
            boxShadow: tokens.elevation['elevation-2'],
          }}
        >
          <Text variant="heading-md" accessibilityRole="header">
            {title}
          </Text>
          <Text tone="textSecondary">{body}</Text>
          <Footer>
            <Button
              ref={cancelRef}
              kind="secondary"
              label={t('common.cancel')}
              onPress={onCancel}
              testID={testID ? `${testID}-cancel` : 'confirm-cancel'}
              autoFocus={destructive}
            />
            {destructive ? (
              <Pressable
                testID={testID ? `${testID}-confirm` : 'confirm-confirm'}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                onPress={onConfirm}
                style={({ pressed }) => ({
                  minHeight: 44,
                  paddingVertical: tokens.spacing['spacing-sm'],
                  paddingHorizontal: tokens.spacing['spacing-lg'],
                  borderRadius: tokens.radius['rounded-pill'],
                  borderWidth: 1,
                  borderColor: theme.inputBorder,
                  backgroundColor: theme.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: tokens.spacing['spacing-sm'],
                  opacity: pressed ? 0.9 : 1,
                  transform: pressed ? [{ scale: 0.98 }] : undefined,
                })}
              >
                <View
                  testID={testID ? `${testID}-ruby` : 'confirm-ruby'}
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.color.ruby }}
                />
                <Text variant="button-md">{confirmLabel}</Text>
              </Pressable>
            ) : (
              <Button testID={testID ? `${testID}-confirm` : 'confirm-confirm'} label={confirmLabel} onPress={onConfirm} />
            )}
          </Footer>
        </View>
      </View>
    </Modal>
  );
}
