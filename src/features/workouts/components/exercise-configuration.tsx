import { Controller, type Control } from 'react-hook-form';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Card, Input } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { WorkoutBuilderValues } from './workout-builder';

export function ExerciseConfiguration({ control, index, name, disabled }: { control: Control<WorkoutBuilderValues>; index: number; name: string; disabled: boolean }) {
  const theme = useAppTheme();
  return <Card><View style={{ gap: 12 }}>
    <Text style={[theme.typography.title, { color: theme.colors.text }]}>{name}: configuration</Text>
    {(['sets', 'reps', 'weight', 'restSeconds'] as const).map((key) => <Controller key={key} control={control} name={`exercises.${index}.${key}`} render={({ field, fieldState }) => <Input ref={field.ref}
      label={key === 'sets' ? 'Target sets' : key === 'reps' ? 'Target reps' : key === 'weight' ? 'Target weight (kg, optional)' : 'Rest time (seconds)'}
      keyboardType={key === 'weight' ? 'decimal-pad' : 'number-pad'} editable={!disabled}
      value={field.value === null || !Number.isFinite(field.value) ? '' : String(field.value)}
      onChangeText={(value) => field.onChange(value.trim() === '' ? key === 'weight' ? null : Number.NaN : Number(value))}
      onBlur={field.onBlur} error={fieldState.error?.message} />
    } />)}
    <Controller control={control} name={`exercises.${index}.notes`} render={({ field, fieldState }) => <Input ref={field.ref} label="Exercise notes" multiline maxLength={1000} editable={!disabled} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
  </View></Card>;
}
