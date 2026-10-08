import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Input } from '@/components/ui';
import { ExercisePicker } from '@/features/workouts/components/exercise-picker';
import { useAppTheme } from '@/theme';
import type { ChallengeInput, FitnessMetric } from '../types/fitness-challenge';
import { challengeInputSchema } from '../validation/challenge-schema';
import { METRIC_LABELS } from '../services/challenge-rules';

export function ChallengeForm({ busy, error, onSave }: { busy: boolean; error: string | null; onSave: (input: ChallengeInput) => Promise<void> }) {
  const theme = useAppTheme(); const [picker,setPicker] = useState(false); const [exerciseName,setExerciseName] = useState('');
  const today = new Date().toISOString().slice(0,10);
  const form = useForm<ChallengeInput>({ resolver:zodResolver(challengeInputSchema),defaultValues:{ title:'',description:'',metric:'workout_count',target:12,startDate:today,endDate:today,visibility:'public',exerciseId:null } });
  const metric = useWatch({ control: form.control, name: 'metric' }); const visibility = useWatch({ control: form.control, name: 'visibility' }); const disabled = busy || form.formState.isSubmitting;
  const metrics: FitnessMetric[] = ['workout_count','volume_kg','repetitions','duration_seconds'];
  return <View style={{ gap:theme.spacing.md }}>
    <Controller control={form.control} name="title" render={({ field,fieldState }) => <Input ref={field.ref} label="Challenge title" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} editable={!disabled} maxLength={150} />} />
    <Controller control={form.control} name="description" render={({ field,fieldState }) => <Input ref={field.ref} label="Description" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} editable={!disabled} multiline maxLength={4000} />} />
    <Text accessibilityRole="header" style={[theme.typography.title,{ color:theme.colors.text }]}>Challenge type</Text>
    <View accessibilityRole="radiogroup" style={{ gap:8 }}>{metrics.map((value) => <Button key={value} label={METRIC_LABELS[value]} accessibilityRole="radio" accessibilityState={{ checked:metric === value }} disabled={disabled} variant={metric === value ? 'primary' : 'secondary'} onPress={() => { form.setValue('metric',value); form.setValue('exerciseId',null); setExerciseName(''); }} />)}</View>
    {metric === 'repetitions' ? <><Button label={exerciseName ? `Exercise: ${exerciseName}` : 'Choose exercise'} variant="secondary" disabled={disabled} onPress={() => setPicker(true)} />{form.formState.errors.exerciseId ? <Text accessibilityRole="alert" style={{ color:theme.colors.danger }}>{form.formState.errors.exerciseId.message}</Text> : null}</> : null}
    <Controller control={form.control} name="target" render={({ field,fieldState }) => <Input ref={field.ref} label={`Target (${metric === 'volume_kg' ? 'kg' : metric === 'duration_seconds' ? 'minutes' : metric === 'repetitions' ? 'reps' : 'workouts'})`} value={Number.isFinite(field.value) ? String(field.value) : ''} onChangeText={(text) => field.onChange(text.trim() ? Number(text) : NaN)} onBlur={field.onBlur} keyboardType="decimal-pad" editable={!disabled} error={fieldState.error?.message} />} />
    <Controller control={form.control} name="startDate" render={({ field,fieldState }) => <Input ref={field.ref} label="Start date (YYYY-MM-DD, UTC)" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} editable={!disabled} maxLength={10} />} />
    <Controller control={form.control} name="endDate" render={({ field,fieldState }) => <Input ref={field.ref} label="End date (YYYY-MM-DD, UTC)" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} editable={!disabled} maxLength={10} />} />
    <Text style={{ color:theme.colors.textMuted }}>Both calendar dates are inclusive. Workouts must start after joining and finish during the challenge.</Text>
    <Text accessibilityRole="header" style={[theme.typography.title,{ color:theme.colors.text }]}>Visibility</Text>
    <View accessibilityRole="radiogroup" style={{ gap:8 }}>{(['public','friends','private'] as const).map((value) => <Button key={value} label={value === 'private' ? 'Invite only' : value === 'friends' ? 'Friends only' : 'Public'} accessibilityRole="radio" accessibilityState={{ checked:visibility === value }} disabled={disabled} variant={visibility === value ? 'primary' : 'secondary'} onPress={() => form.setValue('visibility',value)} />)}</View>
    <Text style={{ color:theme.colors.textMuted }}>Invite accepted friends from the challenge details after creation.</Text>
    {error ? <Text accessibilityRole="alert" style={{ color:theme.colors.danger }}>{error}</Text> : null}
    <Button testID="challenge-submit" label="Create challenge" loading={disabled} onPress={() => { void form.handleSubmit(onSave)(); }} />
    {picker ? <ExercisePicker onClose={() => setPicker(false)} onSelect={(exercise) => { form.setValue('exerciseId',exercise.id,{ shouldValidate:true }); setExerciseName(exercise.name); setPicker(false); }} /> : null}
  </View>;
}
