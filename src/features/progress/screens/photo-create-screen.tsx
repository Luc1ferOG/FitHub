import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { usePhotoDraft } from '../hooks/use-photo-draft';
import { PhotoCamera } from '../components/photo-camera';
import { PhotoMetadataForm } from '../components/photo-metadata-form';
export function PhotoCreateScreen() {
  const theme = useAppTheme(); const router = useRouter(); const draft = usePhotoDraft(); const [cameraOpen, setCameraOpen] = useState(false);
  return <Screen scroll contentStyle={{ gap: 16 }}>
    <Stack.Screen options={{ title: 'New progress photo' }} />
    <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Private progress photo</Text>
    <Text style={{ color: theme.colors.textMuted }}>Choose a still photo. FitHub creates a compressed image and thumbnail before uploading; nothing is shared publicly.</Text>
    {Platform.OS === 'web' ? <Text style={{ color: theme.colors.text }}>Photo capture and uploading are available in the iOS and Android app.</Text> : <>
      <Button label="Take photo with camera" variant="secondary" disabled={draft.busy || draft.locked} onPress={() => setCameraOpen(true)} />
      <Button label="Choose from gallery" variant="secondary" disabled={draft.busy || draft.locked} onPress={() => { void draft.pick(); }} />
    </>}
    {draft.error ? <><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{getErrorMessage(draft.error)}</Text>
      <Button variant="ghost" label="Open device settings" onPress={() => { void Linking.openSettings().catch(() => undefined); }} /></> : null}
    {draft.photo ? <><Image source={{ uri: draft.photo.uri }} cachePolicy="none" accessibilityLabel="Selected progress photo preview" accessible contentFit="contain" style={{ aspectRatio: 3 / 4, width: '100%', borderRadius: theme.radius.lg }} />
      <PhotoMetadataForm disabled={draft.busy} locked={draft.locked} onSave={async (metadata) => { if (await draft.save(metadata)) router.replace('/progress/photos'); }} /></> : null}
    <Button label="Back to photo gallery" variant="ghost" onPress={() => router.back()} />
    {cameraOpen ? <PhotoCamera onClose={() => setCameraOpen(false)} onCapture={draft.choose} /> : null}
  </Screen>;
}
