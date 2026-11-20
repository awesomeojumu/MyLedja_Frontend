import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { useTheme } from '../theme';

export interface DatePickerProps {
  label?: string;
  placeholder?: string;
  value?: string; // YYYY-MM-DD or formatted date
  onChange: (date: string) => void;
  error?: string;
  minDate?: string;
  maxDate?: string;
  containerStyle?: ViewStyle;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0]!, 10);
    const m = parseInt(parts[1]!, 10) - 1;
    const d = parseInt(parts[2]!, 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m < 12) {
      return `${d} ${MONTH_SHORT[m]} ${y}`;
    }
  }
  return iso;
}

export function parseToIso(dateStr?: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

export function DatePicker({
  label,
  placeholder = 'Select date...',
  value,
  onChange,
  error,
  containerStyle,
  disabled = false,
}: DatePickerProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Parse initial viewing month/year from current value or today
  const today = new Date();
  const initialIso = parseToIso(value);

  const initialDate = initialIso
    ? new Date(
        parseInt(initialIso.split('-')[0]!, 10),
        parseInt(initialIso.split('-')[1]!, 10) - 1,
        parseInt(initialIso.split('-')[2]!, 10)
      )
    : today;

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const y = viewYear;
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const isoString = `${y}-${m}-${d}`;
    onChange(isoString);
    setIsOpen(false);
  };

  const handleQuickAdd = (monthsToAdd: number) => {
    const target = new Date();
    target.setMonth(target.getMonth() + monthsToAdd);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    setViewYear(y);
    setViewMonth(target.getMonth());
    onChange(iso);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Calendar math
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const currentIso = parseToIso(value);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
          <CalendarIcon
            size={16}
            color={value ? colors.primary : colors.textSecondary}
            style={{ marginRight: 8 }}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.selectedText,
              {
                color: value ? colors.textPrimary : colors.textTertiary,
                fontFamily: value ? typography.fonts.medium : typography.fonts.regular,
                fontSize: typography.sizes.md,
              },
            ]}
          >
            {value ? formatDateDisplay(value) : placeholder}
          </Text>
        </View>

        {value ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 15 }} />
        )}
      </TouchableOpacity>

      {/* Calendar Popover */}
      {isOpen && (
        <View
          style={[
            styles.calendarPopover,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              marginTop: spacing.xs,
              padding: spacing.md,
            },
          ]}
        >
          {/* Month & Year Navigation Header */}
          <View style={styles.navHeader}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={[styles.navBtn, { borderColor: colors.borderSubtle, borderRadius: radii.sm }]}
            >
              <ChevronLeft size={16} color={colors.textPrimary} />
            </TouchableOpacity>

            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: 14,
              }}
            >
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>

            <TouchableOpacity
              onPress={handleNextMonth}
              style={[styles.navBtn, { borderColor: colors.borderSubtle, borderRadius: radii.sm }]}
            >
              <ChevronRight size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Quick Shortcuts */}
          <View style={styles.shortcutsRow}>
            {[
              { label: 'Today', months: 0 },
              { label: '+1M', months: 1 },
              { label: '+3M', months: 3 },
              { label: '+6M', months: 6 },
              { label: '+1Y', months: 12 },
            ].map((shortcut) => (
              <TouchableOpacity
                key={shortcut.label}
                onPress={() => handleQuickAdd(shortcut.months)}
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 11,
                    fontFamily: typography.fonts.medium,
                  }}
                >
                  {shortcut.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Weekdays Row */}
          <View style={styles.weekdaysRow}>
            {DAY_NAMES.map((name, idx) => (
              <Text
                key={idx}
                style={[
                  styles.weekdayText,
                  {
                    color: colors.textTertiary,
                    fontFamily: typography.fonts.medium,
                  },
                ]}
              >
                {name}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {/* Previous Month Filler Days */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => {
              const dayNum = prevMonthDays - firstDayIndex + idx + 1;
              return (
                <View key={`prev-${idx}`} style={styles.dayCell}>
                  <Text style={[styles.dayText, { color: colors.textTertiary, opacity: 0.35 }]}>
                    {dayNum}
                  </Text>
                </View>
              );
            })}

            {/* Current Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const cellIso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = cellIso === currentIso;
              const isToday = cellIso === todayIso;

              return (
                <TouchableOpacity
                  key={`cur-${dayNum}`}
                  onPress={() => handleSelectDay(dayNum)}
                  style={[
                    styles.dayCell,
                    isSelected && {
                      backgroundColor: colors.primary,
                      borderRadius: radii.full,
                    },
                    !isSelected && isToday && {
                      borderColor: colors.primary,
                      borderWidth: 1,
                      borderRadius: radii.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : isToday
                          ? colors.primary
                          : colors.textPrimary,
                        fontFamily: isSelected || isToday
                          ? typography.fonts.semiBold
                          : typography.fonts.regular,
                      },
                    ]}
                  >
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
    position: 'relative',
    zIndex: 40,
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
  selectedText: {
    flex: 1,
  },
  calendarPopover: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 50,
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayText: {
    width: 32,
    textAlign: 'center',
    fontSize: 11,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayText: {
    fontSize: 12,
  },
  errorText: {},
});
