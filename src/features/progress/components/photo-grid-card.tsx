import { memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { ProgressPhoto } from '../types/progress-photo';
import { PrivatePhotoImage } from './private-photo-image';
export const PhotoGridCard = memo(function PhotoGridCard({ photo, selected, busy, onOpen, onSelect, onDelete }: { photo: ProgressPhoto; selected: boolean; busy: boolean; onOpen: (id: string) => void; onSelect: (id: string) => void; onDelete: (photo: ProgressPhoto) => void }) {
  const theme = useAppTheme();
  const imageStyle = useMemo(() => ({ aspectRatio: 3 / 4, width: '100%' as const, borderRadius: theme.radius.md }), [theme.radius.md]);
  return <View style={{ flex: 1, minWidth: 0, borderWidth: selected ? 2 : 1, borderColor: selected ? theme.colors.primary : theme.colors.border, borderRadius: 16, padding: 8, gap: 8, backgroundColor: theme.colors.surface }}>
    {photo.status === 'ready' ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${photo.pose} photo from ${photo.takenAt.slice(0, 10)} fullscreen`} onPress={() => onOpen(photo.id)} disabled={busy}>
      <PrivatePhotoImage photo={photo} thumbnail style={imageStyle} />
    </Pressable> : <View style={{ height: 180, justifyContent: 'center' }}><Text style={{ color: theme.colors.text }}>{photo.status === 'pending' ? 'Incomplete upload' : 'Deletion pending'}</Text><Text style={{ color: theme.colors.textMuted }}>Retry cleanup below.</Text></View>}
    <Text style={{ color: theme.colors.text }}>{photo.pose} · {photo.takenAt.slice(0, 10)}</Text>
    {photo.status === 'ready' ? <Button label={selected ? 'Selected ✓' : 'Select to compare'} variant="secondary" accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${photo.pose} photo from ${photo.takenAt.slice(0, 10)} for comparison`} accessibilityState={{ selected }} disabled={busy} onPress={() => onSelect(photo.id)} /> : null}
    <Button variant="danger" label={photo.status === 'pending' ? 'Discard upload' : photo.status === 'deleting' ? 'Retry deletion' : 'Delete photo'} disabled={busy} onPress={() => onDelete(photo)} />
  </View>;
});
