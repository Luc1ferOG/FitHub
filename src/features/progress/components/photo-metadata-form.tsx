import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Input } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { localDate } from '../services/measurement-rules';
import { photoMetadataSchema } from '../validation/photo-schema';
import type { PhotoMetadata } from '../types/progress-photo';
export function PhotoMetadataForm({ disabled, locked, onSave }: { disabled: boolean; locked: boolean; onSave: (metadata: PhotoMetadata) => Promise<void> }) {
  const theme = useAppTheme(); const { control, handleSubmit, formState: { errors } } = useForm<PhotoMetadata>({ resolver: zodResolver(photoMetadataSchema), defaultValues: { date: localDate(), pose: 'front', notes: '' } });
  return <View style={{ gap: 16 }}>
    <Controller control={control} name="date" render={({ field }) => <Input ref={field.ref} label="Photo date (YYYY-MM-DD)" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.date?.message} editable={!disabled && !locked} maxLength={10} autoCapitalize="none" />} />
    <Text style={[theme.typography.title, { color: theme.colors.text }]}>Pose</Text>
    <Controller control={control} name="pose" render={({ field }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['front', 'side', 'back'] as const).map((pose) => <Button key={pose} label={pose.charAt(0).toUpperCase() + pose.slice(1)} variant={field.value === pose ? 'primary' : 'secondary'} accessibilityState={{ selected: field.value === pose }} disabled={disabled || locked} onPress={() => field.onChange(pose)} />)}</View>} />
    {errors.pose ? <Text style={{ color: theme.colors.danger }}>{errors.pose.message}</Text> : null}
    <Controller control={control} name="notes" render={({ field }) => <Input ref={field.ref} label="Notes (optional)" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.notes?.message} editable={!disabled && !locked} multiline maxLength={1000} />} />
    {locked ? <Text style={{ color: theme.colors.textMuted }}>Retries keep the same image and details to prevent duplicates. To start over, return to the gallery and discard any incomplete upload.</Text> : null}
    <Button label={disabled ? 'Preparing / uploading…' : locked ? 'Retry upload' : 'Upload private photo'} loading={disabled} onPress={handleSubmit(onSave)} />
  </View>;
}
