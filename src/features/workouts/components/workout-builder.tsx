import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { AccessibilityInfo, ScrollView, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { z } from 'zod';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import type { Workout } from '@/domain/entities/workout';
import type { ExerciseSummary } from '@/features/exercises/types/exercise';
import { useAppTheme } from '@/theme';
import type { WorkoutInput } from '../types/workout';
import { workoutExerciseSchema, workoutSchema } from '../validation/workout-schema';
import { WorkoutDetailsFields } from './workout-details-fields';
import { ExerciseConfiguration } from './exercise-configuration';
import { ReorderExercises } from './reorder-exercises';
import { ExercisePicker } from './exercise-picker';

const builderSchema = workoutSchema.extend({ exercises: z.array(workoutExerciseSchema.extend({ exerciseName: z.string() })).min(1, 'Add at least one exercise').max(100) });
export type WorkoutBuilderValues = z.infer<typeof builderSchema>;
type Props = { initial?: Workout; busy: boolean; error: string | null; onSave: (input: WorkoutInput) => Promise<void> };

export function WorkoutBuilder({ initial, busy, error, onSave }: Props) {
  const theme = useAppTheme();
  const [picker, setPicker] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const form = useForm<WorkoutBuilderValues>({ resolver: zodResolver(builderSchema), defaultValues: {
    name: initial?.name ?? '', description: initial?.description ?? '', isPublic: initial?.isPublic ?? false,
    estimatedDuration: initial?.estimatedDuration ?? null,
    exercises: initial?.exercises.map(({ exerciseId, exerciseName, sets, reps, weight, restSeconds, notes }) => ({ exerciseId, exerciseName, sets, reps, weight, restSeconds, notes })) ?? [],
  } });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'exercises' });
  const selectedIndex = fields.findIndex((field) => field.id === selectedId);
  const currentIndex = selectedId === 'latest' ? fields.length - 1 : selectedIndex >= 0 ? selectedIndex : fields.length > 0 ? 0 : -1;
  const current = fields[currentIndex];
  const disabled = busy || form.formState.isSubmitting;
  const moveExercise = useCallback((from: number, to: number) => {
    if (from === to) return;
    if (selectedId === 'latest' && current) setSelectedId(current.id);
    move(from, to);
    AccessibilityInfo.announceForAccessibility(`Exercise moved to position ${to + 1}`);
  }, [current, move, selectedId]);
  const add = (exercise: ExerciseSummary) => {
    append({ exerciseId: exercise.id, exerciseName: exercise.name, sets: 3, reps: 10, weight: null, restSeconds: 60, notes: '' });
    setPicker(false);
    setSelectedId('latest');
  };
  return <View style={{ flex: 1 }}>
    <ScrollView automaticallyAdjustKeyboardInsets scrollEnabled={!dragging} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: 24, paddingBottom: 32 }}>
      <WorkoutDetailsFields control={form.control} disabled={disabled} />
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>Exercises ({fields.length})</Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Hold a drag handle to reorder, or use the move buttons. Tap an exercise to configure it. Weight is in kilograms.</Text>
      {!fields.length ? <EmptyState title="Build your workout" description="Add your first exercise to get started." /> : null}
      <ReorderExercises items={fields} selectedId={current?.id ?? null} disabled={disabled} onSelect={setSelectedId} onMove={moveExercise} onDrag={setDragging} />
      {current ? <View style={{ gap: 12 }}>
        <ExerciseConfiguration key={current.id} control={form.control} index={currentIndex} name={current.exerciseName} disabled={disabled} />
        <Button label={`Remove ${current.exerciseName}`} variant="ghost" disabled={disabled} onPress={() => { remove(currentIndex); setSelectedId(null); }} />
      </View> : null}
      <Button label="Add exercise" variant="secondary" disabled={disabled || fields.length >= 100} onPress={() => setPicker(true)} />
      {form.formState.errors.exercises ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{form.formState.errors.exercises.root?.message ?? form.formState.errors.exercises.message ?? 'Check each exercise configuration before saving.'}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Button label={disabled ? 'Saving workout…' : 'Save workout'} loading={disabled} disabled={disabled} onPress={() => void form.handleSubmit(async (values) => { await onSave(workoutSchema.parse(values)); })()} />
    </ScrollView>
    {picker ? <ExercisePicker onSelect={add} onClose={() => setPicker(false)} /> : null}
  </View>;
}
