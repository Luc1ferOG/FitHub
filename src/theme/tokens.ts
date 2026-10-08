import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  blue50: '#EFF6FF',
  blue100: '#DBEAFE',
  blue300: '#93C5FD',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  blue700: '#1D4ED8',
  green500: '#22C55E',
  green300: '#86EFAC',
  green700: '#15803D',
  red500: '#EF4444',
  red300: '#FCA5A5',
  red700: '#B91C1C',
  amber500: '#F59E0B',
  amber300: '#FCD34D',
  amber700: '#B45309',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  slate950: '#020617',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const layout = { contentMaxWidth: 760, modalMaxWidth: 560, compactWidth: 380, largeTextScale: 1.3, touchTarget: 48 } as const;
export const motion = { quick: 140, standard: 220 } as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  heading: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>;

export const shadows = {
  none: {},
  sm: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
} as const satisfies Record<string, ViewStyle>;
