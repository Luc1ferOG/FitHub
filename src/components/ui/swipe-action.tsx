import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';
import { useAppTheme } from '@/theme';
import { Button } from './button';
export function SwipeAction({ children, label, onAction, disabled = false }: PropsWithChildren<{ label: string; onAction: () => void; disabled?: boolean }>) {
  const theme = useAppTheme(); const { screenReader, reduceMotion } = useAccessibilityPreferences();
  // Keep the explicit equivalent visible for assistive technology and reduced motion.
  if (screenReader || reduceMotion || disabled) return <View style={{ gap: theme.spacing.sm }}>{children}<Button label={label} variant="ghost" disabled={disabled} onPress={onAction} /></View>;
  return <Swipeable overshootRight={false} friction={2} rightThreshold={48} renderRightActions={() => <View style={{ justifyContent: 'center', paddingLeft: theme.spacing.sm }}><Button label={label} variant="secondary" onPress={onAction} /></View>}>
    {children}
  </Swipeable>;
}
