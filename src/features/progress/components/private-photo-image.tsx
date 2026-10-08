import { Image } from 'expo-image';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { usePhotoImage } from '../hooks/use-photos';
import type { ProgressPhoto } from '../types/progress-photo';
export const PrivatePhotoImage = memo(function PrivatePhotoImage({ photo, thumbnail = false, style, label }: { photo: ProgressPhoto; thumbnail?: boolean; style: ViewStyle; label?: string }) {
  const theme = useAppTheme(); const query = usePhotoImage(photo, thumbnail); const [failedUri, setFailedUri] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const failed = Boolean(query.data && failedUri === query.data);
  const source = useMemo(() => ({ uri: query.data ?? '' }), [query.data]);
  const description = label ?? `${photo.pose} progress photo, ${photo.takenAt.slice(0, 10)}`;
  return <View style={[style, { backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }]}>
    {query.data && !failed ? <Image source={source} enforceEarlyResizing cachePolicy="none" contentFit={thumbnail ? 'cover' : 'contain'} recyclingKey={photo.id}
      accessibilityLabel={description} accessible style={styles.image} onLoadStart={() => setLoading(true)} onLoad={() => setLoading(false)} onError={() => { setFailedUri(query.data ?? null); setLoading(false); }} /> : null}
    {loading && !failed && !query.isError ? <Text accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 12, left: 12, color: theme.colors.text, backgroundColor: theme.colors.surface, padding: 8 }}>Loading private photo…</Text> : null}
    {failed || query.isError ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', padding: 8, gap: 8 }}>
      <Text style={{ color: theme.colors.text }}>Could not load this photo.</Text><Button label="Retry image" variant="secondary" onPress={() => { setFailedUri(null); setLoading(true); void query.refetch(); }} />
    </View> : null}
  </View>;
});
const styles = StyleSheet.create({ image: { width: '100%', height: '100%' } });
