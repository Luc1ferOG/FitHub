import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Platform, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';
import { photoMedia } from '../services/photo-dependencies';
import { permissionDecision, permissionMessage } from '../services/photo-rules';
import type { LocalPhoto } from '../types/progress-photo';
export function PhotoCamera({ onClose, onCapture }: { onClose: () => void; onCapture: (photo: LocalPhoto) => void }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const theme = useAppTheme(); const [permission, request, recheck] = useCameraPermissions(); const camera = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('back'); const [ready, setReady] = useState(false); const [capturing, setCapturing] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active'); const [error, setError] = useState<string | null>(null); const alive = useRef(true); const capturingRef = useRef(false);
  useEffect(() => { alive.current = true; const subscription = AppState.addEventListener('change', (state) => {
    setActive(state === 'active'); setReady(false);
    if (state === 'active') void recheck().catch(() => { if (alive.current) setError('Could not check camera permission. Close and reopen this view.'); });
  }); return () => { alive.current = false; subscription.remove(); }; }, [recheck]);
  const capture = async () => {
    if (!ready || !camera.current || capturingRef.current) return; capturingRef.current = true; setCapturing(true); setError(null);
    try {
      const result = await camera.current.takePictureAsync({ quality: 1, exif: false, skipProcessing: false });
      if (!result) throw new Error('No photo'); const image = { uri: result.uri, width: result.width, height: result.height, owned: true };
      if (alive.current) { onCapture(image); onClose(); } else await photoMedia.cleanup(image);
    } catch { if (alive.current) setError('Could not take the photo. Try again, or choose one from your gallery.'); }
    finally { capturingRef.current = false; if (alive.current) setCapturing(false); }
  };
  return <Modal visible animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}><SafeAreaView accessibilityViewIsModal style={{ flex: 1, backgroundColor: theme.colors.background, padding: 16, gap: 12 }}>
    <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Take a progress photo</Text>
    {Platform.OS === 'web' ? <Text style={{ color: theme.colors.text }}>Use the iOS or Android app to take progress photos.</Text> : !permission ? <LoadingIndicator label="Checking camera permission" /> : permissionDecision(permission) !== 'allowed' ? <View style={{ gap: 12 }}>
      <Text style={{ color: theme.colors.text }}>{permissionMessage('camera', permission)}</Text>
      {permission.canAskAgain ? <Button label="Allow camera access" onPress={() => { void request().catch(() => setError('Camera access could not be requested. Try device settings.')); }} /> : <Button label="Open device settings" onPress={() => { void Linking.openSettings().catch(() => setError('Open FitHub permissions in your device settings.')); }} />}
    </View> : active ? <CameraView key={facing} ref={camera} facing={facing} style={{ flex: 1, borderRadius: 16 }} onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); setError('Camera unavailable. Close this view and choose an image from your gallery.'); }} /> : <Text style={{ color: theme.colors.text }}>Camera paused while the app is in the background.</Text>}
    {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text> : null}
    <Button label="Take photo" loading={capturing} disabled={!ready || !active} onPress={() => { void capture(); }} />
    <Button variant="secondary" label="Switch camera" disabled={capturing || !permission?.granted} onPress={() => { setReady(false); setFacing((value) => value === 'back' ? 'front' : 'back'); }} />
    <Button variant="ghost" label="Cancel camera" onPress={onClose} />
  </SafeAreaView></Modal>;
}
