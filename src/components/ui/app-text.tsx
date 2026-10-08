import { forwardRef } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { useAppTheme } from '@/theme';
export const AppText = forwardRef<NativeText, TextProps>(function AppText({ style, ...props }, ref) {
  const theme = useAppTheme();
  return <NativeText ref={ref} style={[theme.typography.body, { color: theme.colors.text, flexShrink: 1 }, style]} {...props} />;
});
