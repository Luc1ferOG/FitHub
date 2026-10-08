import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
export async function completedSetFeedback(): Promise<void> {
  try {
    if (Platform.OS === 'android') await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
    else if (Platform.OS === 'ios') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch { /* Haptic availability must never affect logging or persistence. */ }
}
