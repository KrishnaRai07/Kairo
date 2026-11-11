import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';
import { isToday, isSameDay, addDays } from '../utils/dateUtils';

interface Props {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

interface CalendarCell {
  date: Date;
  isCurrentMonth: boolean;
  dayNumber: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const CalendarPickerModal: React.FC<Props> = (props) => {
  if (!props.visible) return null;

  return (
    <CalendarPickerModalContent
      key={props.selectedDate.toISOString()}
      {...props}
    />
  );
};

const CalendarPickerModalContent: React.FC<Props> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [viewDate, setViewDate] = useState<Date>(() => new Date(selectedDate));

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Build grid of days for current month
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    // JS getDay(): 0 is Sunday, 1 is Monday. Convert to Monday=0 ... Sunday=6
    const dayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: CalendarCell[] = [];

    // Leading days from previous month
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(currentYear, currentMonth - 1, daysInPrevMonth - i);
      cells.push({
        date: prevDate,
        isCurrentMonth: false,
        dayNumber: daysInPrevMonth - i,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const thisDate = new Date(currentYear, currentMonth, d);
      cells.push({
        date: thisDate,
        isCurrentMonth: true,
        dayNumber: d,
      });
    }

    // Trailing days to fill 5 or 6 complete rows (multiples of 7)
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const daysNeeded = 7 - remainder;
      for (let next = 1; next <= daysNeeded; next++) {
        const nextDate = new Date(currentYear, currentMonth + 1, next);
        cells.push({
          date: nextDate,
          isCurrentMonth: false,
          dayNumber: next,
        });
      }
    }

    return cells;
  }, [currentYear, currentMonth]);

  const handleDayPress = (date: Date) => {
    onSelectDate(date);
    onClose();
  };

  const handleQuickJump = (date: Date) => {
    onSelectDate(date);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalContent}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header Month / Year Navigation */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={handlePrevMonth}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text style={styles.monthTitle}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.navBtn}
              onPress={handleNextMonth}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Days of week header */}
          <View style={styles.weekHeader}>
            {WEEK_DAYS.map((day) => (
              <View key={day} style={styles.weekDayCell}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Day Grid */}
          <View style={styles.grid}>
            {calendarCells.map((cell, idx) => {
              const isSelected = isSameDay(cell.date, selectedDate);
              const isCellToday = isToday(cell.date);

              return (
                <TouchableOpacity
                  key={`${cell.date.toISOString()}_${idx}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isCellToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => handleDayPress(cell.date)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !cell.isCurrentMonth && styles.dayTextMuted,
                      isSelected && styles.dayTextSelected,
                      isCellToday && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {cell.dayNumber}
                  </Text>
                  {isCellToday && (
                    <View
                      style={[
                        styles.todayDot,
                        isSelected && { backgroundColor: '#FFFFFF' },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Jump Shortcuts */}
          <View style={styles.quickBar}>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => handleQuickJump(new Date())}
            >
              <Text style={styles.quickChipText}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => handleQuickJump(addDays(new Date(), 1))}
            >
              <Text style={styles.quickChipText}>Tomorrow</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => handleQuickJump(addDays(new Date(), 7))}
            >
              <Text style={styles.quickChipText}>+7 Days</Text>
            </TouchableOpacity>
          </View>

          {/* Dismiss button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.base,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: theme.spacing.lg,
      width: '100%',
      maxWidth: 380,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : theme.colors.borderSubtle,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    navBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    navBtnText: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.colors.textPrimary,
      lineHeight: 26,
    },
    titleContainer: {
      alignItems: 'center',
    },
    monthTitle: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
      letterSpacing: 0.3,
    },
    weekHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
      paddingHorizontal: 4,
    },
    weekDayCell: {
      width: 38,
      alignItems: 'center',
    },
    weekDayText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 4,
    },
    dayCell: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 2,
    },
    dayCellSelected: {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 4,
    },
    dayCellToday: {
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
    },
    dayText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    dayTextMuted: {
      color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.25)',
    },
    dayTextSelected: {
      color: '#FFFFFF',
      fontWeight: theme.typography.fontWeight.bold,
    },
    dayTextToday: {
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.bold,
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.primary,
      position: 'absolute',
      bottom: 5,
    },
    quickBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.base,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSubtle,
    },
    quickChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    quickChipText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textSecondary,
    },
    closeBtn: {
      marginTop: theme.spacing.md,
      backgroundColor: theme.colors.surfaceSecondary,
      paddingVertical: 12,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    closeBtnText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
  });

