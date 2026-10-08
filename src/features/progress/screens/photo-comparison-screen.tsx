import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { usePhotoComparison } from '../hooks/use-photos';
import { useMeasurementUnits } from '../hooks/use-measurements';
import type { UnitSystem } from '../types/measurement';
import { UnitSelector } from '../components/unit-selector';
import { PrivatePhotoImage } from '../components/private-photo-image';
import { PhotoComparisonValues } from '../components/photo-comparison-values';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
export function PhotoComparisonScreen() {
  const { compact } = useResponsiveLayout();
  const params = useLocalSearchParams<{ first?: string | string[]; second?: string | string[] }>();
  const first = typeof params.first === 'string' ? params.first : ''; const second = typeof params.second === 'string' ? params.second : '';
  const router = useRouter(); const theme = useAppTheme(); const query = usePhotoComparison(first, second); const preference = useMeasurementUnits();
  const [override, setOverride] = useState<UnitSystem | null>(null); const units = override ?? preference.data ?? 'metric';
  return <Screen scroll contentStyle={{ gap: 16 }}>
    <Stack.Screen options={{ title: 'Compare photos' }} />
    <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Before & after</Text>
    {!first || !second ? <EmptyState title="Select two photos" description="Return to your gallery and select two completed uploads." /> : query.isPending ? <LoadingIndicator label="Preparing comparison" /> : query.isError ?
      <EmptyState title="Comparison unavailable" description={getErrorMessage(query.error)} actionLabel="Retry" onAction={() => { void query.refetch(); }} /> : <>
      <Text accessibilityLabel={`${query.data.days} days between photos`} style={[theme.typography.title, { color: theme.colors.text }]}>{query.data.days} {query.data.days === 1 ? 'day' : 'days'} apart</Text>
      {query.data.before.pose !== query.data.after.pose ? <Text style={{ color: theme.colors.textMuted }}>These photos use different poses. Visual comparisons may be less consistent.</Text> : null}
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: theme.spacing.md }}>{([['Before', query.data.before], ['After', query.data.after]] as const).map(([label, photo]) => <View key={photo.id} style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>{label}</Text><Text style={{ color: theme.colors.textMuted }}>{photo.takenAt.slice(0, 10)} · {photo.pose}</Text>
        <PrivatePhotoImage photo={photo} label={`${label}, ${photo.pose} photo, ${photo.takenAt.slice(0, 10)}`} style={{ aspectRatio: 3 / 4, width: '100%', borderRadius: theme.radius.md }} />
        <Button label={`Open ${label.toLowerCase()}`} variant="secondary" onPress={() => router.push({ pathname: '/progress/photos/[photoId]', params: { photoId: photo.id } })} />
      </View>)}</View>
      <UnitSelector units={units} onChange={setOverride} disabled={preference.isPending} />
      {preference.isError ? <Text style={{ color: theme.colors.textMuted }}>Could not load your preferred units. Select the display units above.</Text> : null}
      <PhotoComparisonValues comparison={query.data} units={units} />
    </>}
    <Button label="Back to gallery" variant="ghost" onPress={() => router.replace('/progress/photos')} />
  </Screen>;
}
