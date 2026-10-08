import { Controller, type Control } from 'react-hook-form';
import { Switch, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Input } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { WorkoutBuilderValues } from './workout-builder';

export function WorkoutDetailsFields({ control, disabled }: { control: Control<WorkoutBuilderValues>; disabled: boolean }) {
  const theme = useAppTheme();
  return <View style={{ gap: 12 }}>
    <Controller control={control} name="name" render={({ field, fieldState }) => <Input ref={field.ref} label="Workout name" maxLength={120} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} editable={!disabled} error={fieldState.error?.message} />} />
    <Controller control={control} name="description" render={({ field, fieldState }) => <Input ref={field.ref} label="Description" multiline maxLength={2000} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} editable={!disabled} error={fieldState.error?.message} />} />
    <Controller control={control} name="estimatedDuration" render={({ field, fieldState }) => <Input ref={field.ref} label="Estimated duration (minutes, optional)" keyboardType="decimal-pad" value={field.value === null || !Number.isFinite(field.value) ? '' : String(field.value / 60)} onChangeText={(value) => field.onChange(value.trim() === '' ? null : Number(value) * 60)} onBlur={field.onBlur} editable={!disabled} error={fieldState.error?.message} />} />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={[theme.typography.body, { color: theme.colors.text }]}>Public workout</Text>
      <Controller control={control} name="isPublic" render={({ field }) => <Switch style={{ minHeight: 48, minWidth: 48 }} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} accessibilityLabel="Public workout, visible to other FitHub users" value={field.value} onValueChange={field.onChange} disabled={disabled} />} />
    </View>
  </View>;
}
