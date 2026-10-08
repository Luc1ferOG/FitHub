import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { usePhoto, usePhotoMutations } from '../hooks/use-photos';
import { PrivatePhotoImage } from '../components/private-photo-image';
export function PhotoFullscreenScreen() {
  const params = useLocalSearchParams<{ photoId?: string | string[] }>(); const id = typeof params.photoId === 'string' ? params.photoId : '';
  const router = useRouter(); const theme = useAppTheme(); const query = usePhoto(id); const { remove } = usePhotoMutations();
  const photo = query.data;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.background }}><Screen scroll contentStyle={{ gap: 12 }}><Stack.Screen options={{ headerShown: false }} />
    <Button variant="ghost" label="Close photo" onPress={() => router.canGoBack() ? router.back() : router.replace('/progress/photos')} />
    {!id ? <EmptyState title="Invalid photo link" description="Open a photo from your gallery." /> : query.isPending ? <LoadingIndicator label="Loading photo" /> : query.isError ? <EmptyState title="Photo unavailable" description={getErrorMessage(query.error)} actionLabel="Retry" onAction={() => { void query.refetch(); }} /> : photo ? <>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>{photo.pose} · {photo.takenAt.slice(0, 10)}</Text>
      {photo.status === 'ready' ? <PrivatePhotoImage photo={photo} style={{ aspectRatio: 3 / 4, width: '100%' }} /> : <Text style={{ color: theme.colors.text }}>This photo is incomplete or is pending deletion. Retry cleanup below.</Text>}
      <Text style={{ color: theme.colors.text }}>{photo.notes || 'No notes'}</Text>
      {remove.isError ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{getErrorMessage(remove.error)}</Text> : null}
      <Button label={photo.status === 'ready' ? 'Delete photo' : 'Discard / retry deletion'} loading={remove.isPending} variant="danger" onPress={() => Alert.alert('Delete photo?', 'The full image, thumbnail and metadata will be permanently removed.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(photo.id, { onSuccess: () => router.replace('/progress/photos') }) },
      ])} />
    </> : null}
  </Screen></SafeAreaView>;
}
