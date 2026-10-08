import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { useMeasurements, useMeasurementMutations, useMeasurementUnits } from '../hooks/use-measurements';
import type { Measurement, UnitSystem } from '../types/measurement';
import { UnitSelector } from '../components/unit-selector';
import { MeasurementHistoryRow } from '../components/measurement-history-row';
import { ProgressError } from '../components/progress-error';
export function MeasurementHistoryScreen() {
  const router = useRouter(); const theme = useAppTheme(); const query = useMeasurements(); const preference = useMeasurementUnits(); const { remove } = useMeasurementMutations();
  const [selectedUnits, setSelectedUnits] = useState<UnitSystem | null>(null); const units = selectedUnits ?? preference.data ?? 'metric';
  const entries = useMemo(() => query.data?.pages.flatMap((page) => page.entries) ?? [], [query.data]);
  const deleteMeasurement = remove.mutate;
  const edit = useCallback((id: string) => router.push({ pathname: '/progress/edit/[measurementId]', params: { measurementId: id } }), [router]);
  const confirmDelete = useCallback((entry: Measurement) => Alert.alert('Delete measurement?', `Your entry from ${entry.recordedAt.slice(0, 10)} will be permanently removed.`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteMeasurement(entry.id) },
  ]), [deleteMeasurement]);
  const deleting = remove.isPending;
  const renderEntry = useCallback(({ item }: { item: Measurement }) => <MeasurementHistoryRow entry={item} units={units} deleting={deleting} onEdit={edit} onDelete={confirmDelete} />, [units, deleting, edit, confirmDelete]);
  return <Screen contentStyle={{ gap: 12 }}>
    <FlatList style={{ flex: 1 }} data={entries} keyExtractor={(entry) => entry.id}
      ListHeaderComponent={<View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>    <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Measurement history</Text>
    <Button label="Add measurement" onPress={() => router.push('/progress/create')} />
    <UnitSelector units={units} onChange={setSelectedUnits} disabled={preference.isPending} />
    {preference.isError ? <ProgressError error={preference.error} retry={() => { void preference.refetch(); }} /> : null}
    {remove.isError ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{remove.error.message}</Text> : null}
</View>}
      renderItem={renderEntry}
      refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} initialNumToRender={8} windowSize={5}
      ListEmptyComponent={query.isPending || preference.isPending ? <LoadingIndicator label="Loading measurement history" /> : query.isError ? <ProgressError error={query.error} retry={() => { void query.refetch(); }} /> : <EmptyState title="No measurements yet" description="Add your first entry to start tracking your progress." />}
      ListFooterComponent={<View style={{ paddingVertical: 12 }}>{query.isError && entries.length ? <ProgressError error={query.error} retry={() => { void query.refetch(); }} /> : null}
        {query.hasNextPage ? <Button label="Load more measurements" variant="secondary" loading={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} /> : null}</View>} />
  </Screen>;
}
