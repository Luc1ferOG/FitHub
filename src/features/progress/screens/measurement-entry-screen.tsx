import { AppText as Text } from '@/components/ui/app-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { useMeasurement, useMeasurementMutations, useMeasurementUnits } from '../hooks/use-measurements';
import { MeasurementForm } from '../components/measurement-form';
import { ProgressError } from '../components/progress-error';
export function MeasurementEntryScreen({ editing = false }: { editing?: boolean }) {
  const router = useRouter(); const theme = useAppTheme(); const params = useLocalSearchParams<{ measurementId?: string | string[] }>();
  const id = editing && typeof params.measurementId === 'string' ? params.measurementId : undefined;
  const query = useMeasurement(id); const units = useMeasurementUnits(); const { save } = useMeasurementMutations();
  return <Screen scroll contentStyle={{ gap: 24 }}>
    <Text style={[theme.typography.heading, { color: theme.colors.text }]}>{editing ? 'Edit measurement' : 'New measurement'}</Text>
    {editing && !id ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>Invalid measurement link.</Text> : units.isPending || (editing && query.isPending) ? <LoadingIndicator label="Preparing measurement form" /> : units.isError || (editing && query.isError) ?
      <ProgressError error={units.error ?? query.error} retry={() => { void units.refetch(); if (editing) void query.refetch(); }} /> :
      <MeasurementForm key={id ?? 'new'} {...(editing && query.data ? { initial: query.data } : {})} preferredUnits={units.data ?? 'metric'} saving={save.isPending} error={save.error}
        onSave={(input) => save.mutate({ input, ...(id ? { id } : {}) }, { onSuccess: () => router.replace('/progress/measurements') })} />}
  </Screen>;
}
