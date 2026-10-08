import { forwardRef, type ReactNode, useId, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { MINIMUM_TOUCH_TARGET } from '@/constants/app';
import { useAppTheme } from '@/theme';

export type InputProps = TextInputProps & {
  label: string;
  error?: string | undefined;
  helperText?: string | undefined;
  containerStyle?: ViewStyle;
  rightAccessory?: ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    containerStyle,
    rightAccessory,
    accessibilityLabel = label,
    accessibilityHint,
    accessibilityState,
    onFocus,
    onBlur,
    editable = true,
    style,
    ...props
  },
  ref,
) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const message = error ?? helperText;
  const messageId = `${generatedId}-message`;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text nativeID={`${generatedId}-label`} style={[theme.typography.caption, { color: theme.colors.text }]}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.radius.md,
            opacity: editable ? 1 : 0.8,
          },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={accessibilityLabel}
          accessibilityLabelledBy={`${generatedId}-label`}
          accessibilityHint={[accessibilityHint, message].filter(Boolean).join('. ')}
          accessibilityState={{ ...accessibilityState, disabled: !editable }}
          editable={editable}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          keyboardAppearance={theme.dark ? 'dark' : 'light'}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[
            styles.input,
            theme.typography.body,
            { color: theme.colors.text },
            style,
          ]}
          {...props}
        />
        {rightAccessory}
      </View>
      {message ? (
        <Text
          nativeID={messageId}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={[theme.typography.caption, { color: error ? theme.colors.danger : theme.colors.textMuted }]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
    gap: 8,
  },
  field: {
    minHeight: MINIMUM_TOUCH_TARGET,
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
