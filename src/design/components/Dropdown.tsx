import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import { useTheme } from '../theme';

export interface DropdownOption {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export interface DropdownProps {
  label?: string;
  placeholder?: string;
  value?: string;
  options: (string | DropdownOption)[];
  onSelect: (value: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
  disabled?: boolean;
}

export function Dropdown({
  label,
  placeholder = 'Select an option',
  value,
  options,
  onSelect,
  error,
  containerStyle,
  disabled = false,
}: DropdownProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Normalize options to DropdownOption
  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  const handleSelect = (val: string) => {
    onSelect(val);
    setIsOpen(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: error ? colors.statusDanger : colors.textPrimary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
              marginBottom: spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}

      {/* Trigger Button */}
      <TouchableOpacity
        disabled={disabled}
        onPress={() => setIsOpen((prev) => !prev)}
        activeOpacity={0.7}
        accessibilityRole="combobox"
        accessibilityLabel={label || placeholder}
        // A combobox must say whether its list is open (WCAG 4.1.2).
        accessibilityState={{ expanded: isOpen, disabled: !!disabled }}
        aria-expanded={isOpen}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.statusDanger : isOpen ? colors.primary : colors.border,
            borderWidth: isOpen || error ? 1.5 : 1,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View style={styles.selectedContent}>
          {selectedOption?.icon && <View style={styles.iconWrapper}>{selectedOption.icon}</View>}
          <Text
            numberOfLines={1}
            style={[
              styles.selectedText,
              {
                color: selectedOption ? colors.textPrimary : colors.textTertiary,
                fontFamily: selectedOption ? typography.fonts.medium : typography.fonts.regular,
                fontSize: typography.sizes.md,
              },
            ]}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>

        <View style={styles.chevron}>
          {isOpen ? (
            <ChevronUp size={18} color={colors.primary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {/* Dropdown Menu List */}
      {isOpen && (
        <View
          style={[
            styles.menu,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              borderRadius: radii.md,
              marginTop: spacing.xs,
            },
          ]}
        >
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.menuScroll}
          >
            {normalizedOptions.map((opt, index) => {
              const isSelected = opt.value === value;
              const isLast = index === normalizedOptions.length - 1;

              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => handleSelect(opt.value)}
                  activeOpacity={0.7}
                  style={[
                    styles.menuItem,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                      borderBottomColor: isLast ? 'transparent' : colors.borderSubtle,
                      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                      paddingVertical: spacing.sm + 2,
                      paddingHorizontal: spacing.md,
                    },
                  ]}
                >
                  <View style={styles.itemLeft}>
                    {opt.icon && <View style={styles.iconWrapper}>{opt.icon}</View>}
                    <View style={styles.itemTextContainer}>
                      <Text
                        style={[
                          styles.itemLabel,
                          {
                            color: isSelected ? colors.primary : colors.textPrimary,
                            fontFamily: isSelected ? typography.fonts.semiBold : typography.fonts.regular,
                            fontSize: typography.sizes.sm,
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {opt.subtitle && (
                        <Text
                          style={[
                            styles.itemSubtitle,
                            {
                              color: colors.textSecondary,
                              fontFamily: typography.fonts.regular,
                              fontSize: typography.sizes.xs,
                              marginTop: 2,
                            },
                          ]}
                        >
                          {opt.subtitle}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isSelected && (
                    <Check size={16} color={colors.primary} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {error && (
        <Text
          style={[
            styles.errorText,
            {
              color: colors.statusDanger,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: spacing.xs,
            },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    letterSpacing: -0.1,
  },
  trigger: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  iconWrapper: {
    marginRight: 8,
  },
  selectedText: {
    flex: 1,
  },
  chevron: {
    marginLeft: 4,
  },
  menu: {
    borderWidth: 1,
    maxHeight: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  menuScroll: {
    maxHeight: 220,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLabel: {},
  itemSubtitle: {},
  errorText: {},
});
