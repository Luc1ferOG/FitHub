import { randomUUID } from 'expo-crypto';
import { memo } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Card, Input } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { SessionAction, SessionExercise } from '../types/workout-session';
import { ActiveSetRow } from './active-set-row';

export const ActiveExerciseCard = memo(function ActiveExerciseCard({ exercise, recordIds, onAction }: { exercise: SessionExercise; recordIds: string; onAction: (action: SessionAction) => void }) {
  const theme = useAppTheme();
  const records = new Set(recordIds.split('|'));
  return <Card><View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>{exercise.name}{exercise.skipped ? ' · Skipped' : ''}</Text>
    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Target: {exercise.targetSets} sets × {exercise.targetReps} reps · {exercise.restSeconds}s rest</Text>
    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Previous best set volume: {exercise.bestVolume === null ? 'Not cached' : `${exercise.bestVolume} kg·reps`}</Text>
    {exercise.sets.map((set, index) => <ActiveSetRow key={set.id} set={set} index={index} exerciseId={exercise.id} exerciseName={exercise.name} previous={exercise.previousSets[index]} record={records.has(set.id)} disabled={exercise.skipped} onAction={onAction} />)}
    <Button label={`Add set to ${exercise.name}`} variant="secondary" disabled={exercise.skipped || exercise.sets.length >= 100} onPress={() => onAction({ type: 'add-set', exerciseId: exercise.id, id: randomUUID() })} />
    <Input label={`${exercise.name} notes`} value={exercise.notes} multiline maxLength={1000} onChangeText={(value) => onAction({ type: 'exercise-notes', exerciseId: exercise.id, value })} />
    <Button label={exercise.skipped ? `Resume ${exercise.name}` : `Skip ${exercise.name}`} variant="ghost" onPress={() => onAction({ type: 'skip-exercise', exerciseId: exercise.id })} />
  </View></Card>;
});
