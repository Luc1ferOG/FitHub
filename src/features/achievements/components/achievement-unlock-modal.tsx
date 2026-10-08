import { useEffect } from 'react';
import { AppText as Text } from '@/components/ui/app-text';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button, ModalSurface } from '@/components/ui';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';
import { useAppTheme } from '@/theme';
import type { Achievement } from '../types/achievement';

export function AchievementUnlockModal({ achievement, saving, error, onConfirm, onDismiss }: {
  achievement: Achievement; saving: boolean; error: string | null; onConfirm: () => void; onDismiss: () => void;
}) {
  const theme = useAppTheme(); const scale = useSharedValue(1); const { reduceMotion } = useAccessibilityPreferences();
  useEffect(() => {
    if (reduceMotion) scale.value = 1;
    else { scale.value = 0.96; scale.value = withSpring(1, { damping: 18, stiffness: 180 }); }
    return () => cancelAnimation(scale);
  }, [reduceMotion, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const icon = achievement.icon in Ionicons.glyphMap ? achievement.icon as keyof typeof Ionicons.glyphMap : 'trophy-outline';
  return <ModalSurface title="Achievement unlocked!" onClose={onDismiss} busy={saving} closeLabel="Close for now">
      <Animated.View style={[{ gap: theme.spacing.lg }, animated]}>
        <Ionicons name={icon} size={56} color={theme.colors.primary} accessible={false} />
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>{achievement.title}</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{achievement.description}</Text>
        {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text> : null}
        <Button label="Continue" loading={saving} onPress={onConfirm} />
      </Animated.View>
  </ModalSurface>;
}
