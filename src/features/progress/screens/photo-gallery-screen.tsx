import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { usePhotoMutations, usePhotos } from '../hooks/use-photos';
import { photoGridRows } from '../services/photo-rules';
import type { ProgressPhoto } from '../types/progress-photo';
import { PhotoGridCard } from '../components/photo-grid-card';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
export function PhotoGalleryScreen() {
  const { compact } = useResponsiveLayout();
  const router = useRouter(); const theme = useAppTheme(); const query = usePhotos(); const { remove } = usePhotoMutations();
  const [selected, setSelected] = useState<string[]>([]); const [notice, setNotice] = useState<string | null>(null);
  const photos = useMemo(() => query.data?.pages.flatMap((page) => page.entries) ?? [], [query.data]);
  const rows = useMemo(() => photoGridRows(photos), [photos]); const removePhoto = remove.mutate; const deleting = remove.isPending;
  const open = useCallback((id: string) => router.push({ pathname: '/progress/photos/[photoId]', params: { photoId: id } }), [router]);
  const choose = useCallback((id: string) => { setNotice(null); setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 2 ? [...current, id] : current); }, []);
  const confirmDelete = useCallback((photo: ProgressPhoto) => Alert.alert('Delete private photo?', `Permanently remove the ${photo.pose} photo from ${photo.takenAt.slice(0, 10)} and its thumbnail?`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => removePhoto(photo.id, { onSuccess: () => setSelected((current) => current.filter((id) => id !== photo.id)) }) },
  ]), [removePhoto]);
  const renderRow = useCallback(({ item }: { item: typeof rows[number] }) => <View style={{ gap: 12, marginBottom: 16 }}>
    {item.heading ? <Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>{item.date}</Text> : null}
    <View style={{ flexDirection: compact ? 'column' : 'row', gap: theme.spacing.md }}>{item.photos.map((photo) => <PhotoGridCard key={photo.id} photo={photo} selected={selected.includes(photo.id)} busy={deleting} onOpen={open} onSelect={choose} onDelete={confirmDelete} />)}{!compact && item.photos.length === 1 ? <View style={{ flex: 1 }} /> : null}</View>
  </View>, [theme, selected, deleting, open, choose, confirmDelete, compact]);
  return <Screen contentStyle={{ gap: 12 }}>
    <FlatList data={rows} renderItem={renderRow} keyExtractor={(row) => row.key} style={{ flex: 1 }} initialNumToRender={4} maxToRenderPerBatch={4} windowSize={5}
      ListHeaderComponent={<View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>    <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Progress photos</Text>
    <Text style={{ color: theme.colors.textMuted }}>Private to you. Select two completed photos to compare.</Text>
    {selected.length === 2 ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>Two photos selected. Deselect one to choose a different photo.</Text> : null}
    <Button label="Add progress photo" onPress={() => router.push('/progress/photos/create')} />
    <Button label={`Compare selected (${selected.length}/2)`} disabled={selected.length !== 2 || deleting} variant="secondary" onPress={() => {
      const first = selected[0]; const second = selected[1];
      if (!first || !second || !photos.some((photo) => photo.id === first && photo.status === 'ready') || !photos.some((photo) => photo.id === second && photo.status === 'ready')) { setNotice('One selected photo is no longer available. Select two completed photos again.'); setSelected([]); return; }
      router.push({ pathname: '/progress/photos/compare', params: { first, second } });
    }} />
    {notice || remove.isError ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{notice ?? getErrorMessage(remove.error)}</Text> : null}
</View>}
      refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { if (!query.isFetching) void query.refetch(); }}
      ListEmptyComponent={query.isPending ? <LoadingIndicator label="Loading private photo gallery" /> : query.isError ? <EmptyState title="Gallery unavailable" description={getErrorMessage(query.error)} actionLabel="Retry" onAction={() => { void query.refetch(); }} /> : <EmptyState title="Your private photo timeline" description="Take or choose your first photo. Use a consistent pose to make comparisons easier." />}
      ListFooterComponent={<View style={{ paddingVertical: 12 }}>{query.isError && photos.length ? <EmptyState title="Could not refresh photos" description={getErrorMessage(query.error)} actionLabel="Retry" onAction={() => { void query.refetch(); }} /> : null}{query.hasNextPage ? <Button label="Load more photos" disabled={query.isFetching} loading={query.isFetchingNextPage} variant="secondary" onPress={() => { if (!query.isFetching) void query.fetchNextPage(); }} /> : null}</View>} />
  </Screen>;
}
