import { useEffect, type PropsWithChildren } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';
import { useAppTheme } from '@/theme';
export function MotionView({ children, visible = true, style }: PropsWithChildren<{ visible?: boolean; style?: ViewStyle }>) {
  const { reduceMotion } = useAccessibilityPreferences(); const theme = useAppTheme();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!visible || reduceMotion) opacity.value = 1;
    else { opacity.value = 0.65; opacity.value = withTiming(1, { duration: theme.motion.standard }); }
    return () => cancelAnimation(opacity);
  }, [opacity, visible, reduceMotion, theme.motion.standard]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
