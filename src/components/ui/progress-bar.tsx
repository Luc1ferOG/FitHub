import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';
import { useAppTheme } from '@/theme';
export function ProgressBar({ value, label, description }: { value: number; label: string; description?: string }) {
  const theme = useAppTheme(); const { reduceMotion } = useAccessibilityPreferences();
  const percent = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const progress = useSharedValue(percent);
  useEffect(() => { progress.value = reduceMotion ? percent : withTiming(percent, { duration: theme.motion.standard }); return () => cancelAnimation(progress); }, [percent, progress, reduceMotion, theme.motion.standard]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.value}%` as `${number}%` }));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(percent), text: description ?? `${Math.round(percent)} percent complete` }} style={{ height: 8, backgroundColor: theme.colors.border, borderRadius: theme.radius.full, overflow: 'hidden' }}>
    <Animated.View style={[{ height: '100%', backgroundColor: theme.colors.primary, borderRadius: theme.radius.full }, animated]} />
  </View>;
}
