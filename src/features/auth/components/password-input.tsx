import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInput } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { Input, type InputProps } from '@/components/ui';
import { MINIMUM_TOUCH_TARGET } from '@/constants/app';
import { useAppTheme } from '@/theme';

type PasswordInputProps = Omit<InputProps, 'rightAccessory' | 'secureTextEntry'>;

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(function PasswordInput(props, ref) {
  const [isVisible, setIsVisible] = useState(false);
  const theme = useAppTheme();
  const action = isVisible ? 'Hide' : 'Show';

  return (
    <Input
      {...props}
      ref={ref}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={!isVisible}
      rightAccessory={
        <Pressable
          accessibilityLabel={`${action} ${props.label.toLowerCase()}`}
          accessibilityRole="button"
          hitSlop={4}
          accessibilityState={{ disabled: props.editable === false }}
          disabled={props.editable === false}
          onPress={() => setIsVisible((visible) => !visible)}
          style={styles.toggle}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>{action}</Text>
        </Pressable>
      }
    />
  );
});

const styles = StyleSheet.create({
  toggle: {
    minHeight: MINIMUM_TOUCH_TARGET,
    minWidth: MINIMUM_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
