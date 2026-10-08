import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type View,
  type ViewStyle,
} from 'react-native';

import { MINIMUM_TOUCH_TARGET } from '@/constants/app';
import { useAppTheme } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export const Button = forwardRef<View, ButtonProps>(
  function Button(
    {
      label,
      variant = 'primary',
      loading = false,
      fullWidth = false,
      disabled,
      accessibilityLabel = label,
      accessibilityState,
      style,
      ...props
    },
    ref,
  ) {
    const theme = useAppTheme();
    const isDisabled = disabled || loading;

    const colorsByVariant: Record<ButtonVariant, { background: string; text: string; border: string }> = {
      primary: {
        background: theme.colors.primary,
        text: theme.colors.primaryContrast,
        border: theme.colors.primary,
      },
      secondary: {
        background: theme.colors.surface,
        text: theme.colors.primary,
        border: theme.colors.border,
      },
      ghost: {
        background: theme.colors.transparent,
        text: theme.colors.primary,
        border: theme.colors.transparent,
      },
      danger: {
        background: theme.colors.danger,
        text: theme.colors.dangerContrast,
        border: theme.colors.danger,
      },
    };
    const colors = colorsByVariant[variant];

    return (
      <Pressable
        ref={ref}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ ...accessibilityState, disabled: Boolean(isDisabled), busy: loading }}
        disabled={isDisabled}
        hitSlop={4}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderRadius: theme.radius.md,
            opacity: isDisabled ? 0.7 : pressed ? 0.9 : 1,
          },
          fullWidth && styles.fullWidth,
          style,
        ]}
        {...props}
      >
        {loading ? <ActivityIndicator color={colors.text} accessible={false} /> : null}
        <Text style={[theme.typography.button, { color: colors.text, textAlign: 'center', flexShrink: 1 }]}>{label}</Text>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    minHeight: MINIMUM_TOUCH_TARGET,
    minWidth: MINIMUM_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
