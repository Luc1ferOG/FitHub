import { memo } from 'react';
import { Pressable } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import type { WorkoutSummary } from '@/domain/entities/workout';
import { useAppTheme } from '@/theme';

export const WorkoutCard = memo(function WorkoutCard({ workout, onSelect }: { workout: WorkoutSummary; onSelect: (id: string) => void }) {
  const theme = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${workout.name}, ${workout.isPublic ? 'public' : 'private'} workout`} accessibilityHint="Open workout details for management actions. Swipe left in your workouts list for an edit shortcut." onPress={() => onSelect(workout.id)} style={{ padding: 16, gap: 8, minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }}>
    <Text style={[theme.typography.title, { color: theme.colors.text }]}>{workout.name}</Text>
    {workout.description ? <Text numberOfLines={2} style={[theme.typography.body, { color: theme.colors.textMuted }]}>{workout.description}</Text> : null}
    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{workout.isPublic ? 'Public' : 'Private'}{workout.estimatedDuration ? ` · ${Math.round(workout.estimatedDuration / 60)} min` : ''}</Text>
  </Pressable>;
});
