import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryTint: string;
  primaryGlow: string;

  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceMuted: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  borderSubtle: string;
  borderMedium: string;
  borderFocus: string;

  status: {
    inProgress: string;
    inProgressBg: string;
    inProgressBorder: string;

    upcoming: string;
    upcomingBg: string;
    upcomingBorder: string;

    completed: string;
    completedBg: string;
    completedBorder: string;

    completedLate: string;
    completedLateBg: string;
    completedLateBorder: string;

    missed: string;
    missedBg: string;
    missedBorder: string;

    skipped: string;
    skippedBg: string;
    skippedBorder: string;

    danger: string;
    dangerBg: string;
    dangerBorder: string;
  };

  priority: {
    high: string;
    highBg: string;
    medium: string;
    mediumBg: string;
    low: string;
    lowBg: string;
  };
}

export const darkColors: ThemeColors = {
  // Obsidian Precision — Focus, Surgical Clarity & Laser Glow
  primary: '#6366F1', // Electric Indigo
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  primaryTint: 'rgba(99, 102, 241, 0.15)',
  primaryGlow: 'rgba(99, 102, 241, 0.25)',

  background: '#0B0F19', // Deep Obsidian Void
  surface: '#111827',     // Precision Glass Card
  surfaceSecondary: '#161F30', // Layered Depth
  surfaceMuted: '#1E293B',

  textPrimary: '#F9FAFB',   // Maximum contrast crisp white
  textSecondary: '#9CA3AF', // Muted slate
  textMuted: '#6B7280',     // Dark slate
  textInverse: '#0B0F19',

  borderSubtle: 'rgba(255, 255, 255, 0.08)', // 1px glass highlight
  borderMedium: 'rgba(255, 255, 255, 0.16)',
  borderFocus: '#38BDF8',

  status: {
    inProgress: '#38BDF8', // Laser Cyan
    inProgressBg: 'rgba(56, 189, 248, 0.12)',
    inProgressBorder: 'rgba(56, 189, 248, 0.35)',

    upcoming: '#818CF8', // Electric Violet
    upcomingBg: 'rgba(129, 140, 248, 0.12)',
    upcomingBorder: 'rgba(129, 140, 248, 0.25)',

    completed: '#10B981', // Matrix Emerald
    completedBg: 'rgba(16, 185, 129, 0.12)',
    completedBorder: 'rgba(16, 185, 129, 0.3)',

    completedLate: '#14B8A6', // Recovery Teal
    completedLateBg: 'rgba(20, 184, 166, 0.12)',
    completedLateBorder: 'rgba(20, 184, 166, 0.3)',

    missed: '#F59E0B', // Sunset Amber
    missedBg: 'rgba(245, 158, 11, 0.12)',
    missedBorder: 'rgba(245, 158, 11, 0.35)',

    skipped: '#6B7280',
    skippedBg: 'rgba(107, 114, 128, 0.12)',
    skippedBorder: 'rgba(107, 114, 128, 0.25)',

    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.12)',
    dangerBorder: 'rgba(239, 68, 68, 0.35)',
  },

  priority: {
    high: '#EF4444',
    highBg: 'rgba(239, 68, 68, 0.18)',
    medium: '#F59E0B',
    mediumBg: 'rgba(245, 158, 11, 0.18)',
    low: '#10B981',
    lowBg: 'rgba(16, 185, 129, 0.18)',
  },
};

export const lightColors: ThemeColors = {
  // Nordic Breath (Warm canvas for light mode)
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',
  primaryTint: '#EEF2FF',
  primaryGlow: 'rgba(79, 70, 229, 0.15)',

  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceSecondary: '#F4F1EA',
  surfaceMuted: '#EAE6DF',

  textPrimary: '#1E2530',
  textSecondary: '#5C667A',
  textMuted: '#8F9AA8',
  textInverse: '#FFFFFF',

  borderSubtle: '#EAE6DF',
  borderMedium: '#D9D3C7',
  borderFocus: '#4F46E5',

  status: {
    inProgress: '#2563EB',
    inProgressBg: '#EFF6FF',
    inProgressBorder: '#BFDBFE',

    upcoming: '#6366F1',
    upcomingBg: '#EEF2FF',
    upcomingBorder: '#C7D2FE',

    completed: '#059669',
    completedBg: '#ECFDF5',
    completedBorder: '#A7F3D0',

    completedLate: '#0D9488',
    completedLateBg: '#F0FDFA',
    completedLateBorder: '#99F6E4',

    missed: '#D97706',
    missedBg: '#FFFBEB',
    missedBorder: '#FDE68A',

    skipped: '#64748B',
    skippedBg: '#F4F1EA',
    skippedBorder: '#EAE6DF',

    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },

  priority: {
    high: '#EF4444',
    highBg: '#FEF2F2',
    medium: '#F59E0B',
    mediumBg: '#FFFBEB',
    low: '#10B981',
    lowBg: '#ECFDF5',
  },
};

export const getTheme = (mode: ThemeMode | string = 'dark') => {
  const resolvedMode: ThemeMode = mode === 'light' ? 'light' : 'dark';
  const colors = resolvedMode === 'light' ? lightColors : darkColors;

  return {
    mode: resolvedMode,
    colors,
    typography: {
      fontMono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: {
        xs: 11,
        sm: 13,
        base: 15,
        md: 16,
        lg: 18,
        xl: 21,
        xxl: 26,
        display: 32,
      },
      lineHeight: {
        tight: 16,
        normal: 22,
        relaxed: 26,
      },
      fontWeight: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
        heavy: '800' as const,
      },
    },

    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      base: 16,
      lg: 20,
      xl: 24,
      xxl: 32,
    },

    radius: {
      xs: 6,
      sm: 10,
      md: 14,
      lg: 20,
      xl: 28,
      full: 9999,
    },

    shadows: {
      subtle: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 3,
      },
      elevated: {
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25, // Cyan ambient glow
        shadowRadius: 16,
        elevation: 8,
      },
      modal: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 16,
      },
    },

    layout: {
      minTouchTarget: 44,
    },
  };
};

// Obsidian Precision is the primary default theme
export type Theme = ReturnType<typeof getTheme>;
export const theme = getTheme('dark');
