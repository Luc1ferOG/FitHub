import { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { useMeasurementUnits, useProgressDashboard } from '../hooks/use-measurements';
import type { ProgressPeriod, UnitSystem } from '../types/measurement';
import { UnitSelector } from '../components/unit-selector';
import { MeasurementSummary } from '../components/measurement-summary';
import { ProgressChart } from '../components/progress-chart';
import { ProgressError } from '../components/progress-error';
const periods: readonly { value: ProgressPeriod; label: string }[] = [{ value: '30d', label: '30 days' }, { value: '3m', label: '3 months' }, { value: '6m', label: '6 months' }, { value: '1y', label: '1 year' }, { value: 'all', label: 'All time' }];
export function ProgressDashboardScreen() {
  const router = useRouter(); const theme = useAppTheme(); const [period, setPeriod] = useState<ProgressPeriod>('30d');
  const [selectedUnits, setSelectedUnits] = useState<UnitSystem | null>(null); const preference = useMeasurementUnits(); const query = useProgressDashboard(period);
  const units = selectedUnits ?? preference.data ?? 'metric';
  return <Screen scroll contentStyle={{ gap: 24 }}>
    <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Your progress</Text>
    <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>A private record of how your body changes over time.</Text>
    <View style={{ gap: 8 }}><Button label="Add measurement" onPress={() => router.push('/progress/create')} /><Button label="Measurement history" variant="secondary" onPress={() => router.push('/progress/measurements')} /></View>
    <Button label="Private progress photos" variant="secondary" onPress={() => router.push('/progress/photos')} />
    <UnitSelector units={units} onChange={setSelectedUnits} disabled={preference.isPending} />
    {preference.isError ? <ProgressError error={preference.error} retry={() => { void preference.refetch(); }} /> : null}
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{periods.map((item) => <Button key={item.value} label={item.label} variant={item.value === period ? 'primary' : 'secondary'} accessibilityState={{ selected: item.value === period }} onPress={() => setPeriod(item.value)} />)}</View>
    {query.isPending || preference.isPending ? <LoadingIndicator label="Loading your measurements" /> : query.isError ? <ProgressError error={query.error} retry={() => { void query.refetch(); }} /> : query.data.count === 0 ?
      <EmptyState title="Start with one measurement" description="Record your weight or any body measurement to build your personal timeline." actionLabel="Record first measurement" onAction={() => router.push('/progress/create')} /> : <>
        <MeasurementSummary dashboard={query.data} units={units} />
        <Text style={{ color: theme.colors.textMuted }}>Charts use up to 120 time-bucket averages. Summary cards show exact entries across all time. A single point is shown when only one entry exists.</Text>
        {(['weightKg', 'waistCm', 'bodyFatPercentage'] as const).map((field) => <ProgressChart key={`${period}:${field}`} points={query.data.points} field={field} units={units} />)}
      </>}
    <Button label={query.isFetching ? 'Refreshing…' : 'Refresh progress'} variant="ghost" disabled={query.isFetching} onPress={() => { void query.refetch(); }} />
  </Screen>;
}
