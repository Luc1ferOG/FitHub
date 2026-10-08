import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Input } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { measurementUnit } from '@/utils/units';
import { measurementFields, type MeasurementInput, type UnitSystem } from '../types/measurement';
import { emptyMeasurementForm, fieldLabels, formToMeasurement, measurementToForm, type MeasurementFormValues } from '../services/measurement-rules';
import { measurementSchema } from '../validation/measurement-schema';
import { UnitSelector } from './unit-selector';

export function MeasurementForm({ initial, preferredUnits, saving, error, onSave }: {
  initial?: MeasurementInput; preferredUnits: UnitSystem; saving: boolean; error: unknown; onSave: (input: MeasurementInput) => void;
}) {
  const theme = useAppTheme(); const [units, setUnits] = useState(preferredUnits); const [conversionError, setConversionError] = useState<string | null>(null);
  const { control, handleSubmit, getValues, reset, formState: { errors } } = useForm<MeasurementFormValues>({ resolver: zodResolver(measurementSchema(units)), defaultValues: initial ? measurementToForm(initial, preferredUnits) : emptyMeasurementForm() });
  const switchUnits = (next: UnitSystem) => {
    if (next === units) return;
    try {
      const current = getValues(); const blank = measurementFields.every((field) => !current[field].trim());
      if (!blank) reset({ ...measurementToForm(formToMeasurement({ ...current, date: '2000-01-01' }, units, initial), next), date: current.date });
      setUnits(next); setConversionError(null);
    } catch { setConversionError('Correct the numeric values before changing units.'); }
  };
  return <View style={{ gap: theme.spacing.lg }}>
    <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>All fields are optional; enter at least one. Your measurements stay private.</Text>
    <UnitSelector units={units} onChange={switchUnits} disabled={saving} />
    <Controller control={control} name="date" render={({ field }) => <Input ref={field.ref} label="Date (YYYY-MM-DD)" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.date?.message} editable={!saving} autoCapitalize="none" maxLength={10} />} />
    {measurementFields.map((name) => <Controller key={name} control={control} name={name} render={({ field }) => <Input ref={field.ref} label={`${fieldLabels[name]} (${measurementUnit(name, units)})`} keyboardType="decimal-pad" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors[name]?.message} editable={!saving} maxLength={16} />} />)}
    {conversionError || error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{conversionError ?? getErrorMessage(error)}</Text> : null}
    <View><Button label={saving ? 'Saving measurement…' : initial ? 'Save changes' : 'Save measurement'} loading={saving} onPress={handleSubmit((values) => {
      try { onSave(formToMeasurement(values, units, initial)); setConversionError(null); } catch (cause) { setConversionError(getErrorMessage(cause)); }
    })} /></View>
  </View>;
}
