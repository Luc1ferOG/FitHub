import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';

import { layout, motion, palette, radius, shadows, spacing, typography } from './tokens';

const lightColors = {
  background: palette.slate50,
  surface: palette.white,
  surfaceMuted: palette.slate100,
  text: palette.slate900,
  textMuted: palette.slate700,
  border: palette.slate200,
  primary: palette.blue600,
  primaryPressed: palette.blue700,
  primaryContrast: palette.white,
  success: palette.green700,
  warning: palette.amber700,
  warningContrast: palette.white,
  danger: palette.red700,
  dangerContrast: palette.white,
  media: palette.black,
  overlay: 'rgba(15, 23, 42, 0.48)',
  transparent: palette.transparent,
} as const;

const darkColors = {
  background: palette.slate950,
  surface: palette.slate900,
  surfaceMuted: palette.slate800,
  text: palette.slate50,
  textMuted: palette.slate400,
  border: palette.slate700,
  primary: palette.blue300,
  primaryPressed: palette.blue600,
  primaryContrast: palette.slate950,
  success: palette.green300,
  warning: palette.amber300,
  warningContrast: palette.slate950,
  danger: palette.red300,
  dangerContrast: palette.slate950,
  media: palette.black,
  overlay: 'rgba(2, 6, 23, 0.72)',
  transparent: palette.transparent,
} as const;

export type AppColors = { [ColorName in keyof typeof lightColors]: string };

export type AppTheme = {
  dark: boolean;
  colors: AppColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  layout: typeof layout;
  motion: typeof motion;
  shadows: typeof shadows;
  navigation: NavigationTheme;
};

export const lightTheme: AppTheme = {
  dark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
  layout,
  motion,
  shadows,
  navigation: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: lightColors.primary,
      background: lightColors.background,
      card: lightColors.surface,
      text: lightColors.text,
      border: lightColors.border,
      notification: lightColors.danger,
    },
  },
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: darkColors,
  spacing,
  radius,
  typography,
  layout,
  motion,
  shadows,
  navigation: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: darkColors.primary,
      background: darkColors.background,
      card: darkColors.surface,
      text: darkColors.text,
      border: darkColors.border,
      notification: darkColors.danger,
    },
  },
};
