import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme';

export interface ToastProps {
  visible: boolean;
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({
  visible,
  message,
  onUndo,
  onDismiss,
  durationMs = 5000,
}: ToastProps) {
  const { colors, typography, spacing, radii } = useTheme();

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.floatingContainer}>
      <View
        style={[
          styles.toast,
          {
            backgroundColor: colors.textPrimary,
            borderRadius: radii.full,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <Text
          style={[
            styles.message,
            {
              color: colors.textInverse,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.sm,
            },
          ]}
        >
          {message}
        </Text>

        {onUndo && (
          <TouchableOpacity
            onPress={() => {
              onUndo();
              onDismiss();
            }}
            style={[styles.undoButton, { marginLeft: spacing.md }]}
          >
            <Text
              style={[
                styles.undoText,
                {
                  color: colors.primary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.sm,
                },
              ]}
            >
              Undo
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  message: {},
  undoButton: {},
  undoText: {
    textDecorationLine: 'underline',
  },
});
