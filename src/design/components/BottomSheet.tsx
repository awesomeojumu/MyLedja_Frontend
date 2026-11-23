import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme';

import { t } from '../../i18n';
export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Center-positioned Modal Popup dialog across mobile, tablet, and desktop.
 */
export function BottomSheet({ visible, onClose, title, subtitle, children }: BottomSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.popupCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderRadius: radii.xl,
                },
              ]}
            >
              {/* Header */}
              <View
                style={[
                  styles.header,
                  {
                    borderBottomColor: colors.borderSubtle,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <View style={styles.titleArea}>
                  <Text
                    style={[
                      styles.title,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fonts.semiBold,
                        fontSize: typography.sizes.lg,
                      },
                    ]}
                  >
                    {title}
                  </Text>
                  {subtitle && (
                    <Text
                      style={[
                        styles.subtitle,
                        {
                          color: colors.textSecondary,
                          fontFamily: typography.fonts.regular,
                          fontSize: typography.sizes.xs,
                          marginTop: 2,
                        },
                      ]}
                    >
                      {subtitle}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('ui.bottomSheet.close')}
                  onPress={onClose}
                  style={[
                    styles.closeButton,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderRadius: radii.full,
                    },
                  ]}
                >
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <ScrollView
                style={styles.body}
                contentContainerStyle={{ padding: spacing.lg }}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// Convenient alias for semantic readability
export const ModalPopup = BottomSheet;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  popupCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '88%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleArea: {
    flex: 1,
  },
  title: {},
  subtitle: {},
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexGrow: 0,
  },
});
