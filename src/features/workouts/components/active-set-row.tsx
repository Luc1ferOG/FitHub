import { memo, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { completedSetFeedback } from '@/services/device/haptics';
import { Button, Input } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { LoggedSet, PreviousSet, SessionAction } from '../types/workout-session';

type Props = { set: LoggedSet; index: number; exerciseId: string; exerciseName: string; previous: PreviousSet | undefined;
  record: boolean; disabled: boolean; onAction: (action: SessionAction) => void };
export const ActiveSetRow = memo(function ActiveSetRow({ set, index, exerciseId, exerciseName, previous, record, disabled, onAction }: Props) {
  const theme = useAppTheme();
  const scale = useSharedValue(1);
  const completed = set.completedAt !== null;
  const previousCompleted = useRef(completed);
  const { reduceMotion } = useAccessibilityPreferences(); const { compact } = useResponsiveLayout();
  useEffect(() => {
    if (completed && !previousCompleted.current) void completedSetFeedback();
    previousCompleted.current = completed;
    if (reduceMotion) scale.value = 1;
    else if (completed) scale.value = withSequence(withTiming(1.015, { duration: 130 }), withSpring(1));
    else scale.value = withTiming(1);
    return () => cancelAnimation(scale);
  }, [completed, reduceMotion, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const prefix = `${exerciseName}, set ${index + 1}`;
  return <Animated.View style={[{ padding: 12, gap: 8, borderRadius: theme.radius.md, borderWidth: 2, borderColor: completed ? theme.colors.primary : theme.colors.border }, animated]}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
      <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>Set {index + 1}{completed ? ' · Completed' : ''}</Text>
      {record ? <Text accessibilityLabel={`${prefix}, provisional personal record`} style={{ color: theme.colors.primary }}>PR candidate</Text> : null}
    </View>
    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Previous: {previous ? `${previous.weight} kg × ${previous.reps}` : 'No previous result cached'}</Text>
    <View style={{ flexDirection: compact ? 'column' : 'row', gap: theme.spacing.md }}>
      <Input label="Weight (kg)" accessibilityLabel={`${prefix}, weight in kilograms`} value={set.weight} keyboardType="decimal-pad" maxLength={16} editable={!disabled && !completed} containerStyle={{ flex: 1 }} onChangeText={(value) => onAction({ type: 'set-value', exerciseId, setId: set.id, field: 'weight', value }) />
      <Input label="Reps" accessibilityLabel={`${prefix}, reps`} value={set.reps} keyboardType="number-pad" maxLength={5} editable={!disabled && !completed} containerStyle={{ flex: 1 }} onChangeText={(value) => onAction({ type: 'set-value', exerciseId, setId: set.id, field: 'reps', value }) />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`${prefix}, completed`} accessibilityState={{ checked: completed, disabled }} disabled={disabled} onPress={() => onAction({ type: 'toggle-set', exerciseId, setId: set.id, now: Date.now() })} style={{ minHeight: 48, minWidth: 48, padding: 12 }}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.primary }]}>{completed ? '✓ Completed' : '○ Complete set'}</Text>
      </Pressable>
      <Button label="Remove" accessibilityLabel={`Remove ${prefix}`} variant="ghost" disabled={disabled} onPress={() => onAction({ type: 'remove-set', exerciseId, setId: set.id })} />
    </View>
  </Animated.View>;
});
