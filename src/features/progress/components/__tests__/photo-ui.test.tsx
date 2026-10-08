import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { AppThemeProvider } from '@/theme';
import { PhotoCamera } from '../photo-camera';
import { PhotoComparisonValues } from '../photo-comparison-values';
import type { ProgressPhoto } from '../../types/progress-photo';
jest.mock('expo-camera', () => ({ CameraView: 'CameraView', useCameraPermissions: () => [{ granted: false, canAskAgain: false }, jest.fn(), jest.fn().mockResolvedValue({ granted: false, canAskAgain: false })] }));
jest.mock('../../services/photo-dependencies', () => ({ photoMedia: { cleanup: jest.fn() } }));
it('offers device settings for a permanently denied camera and allows cancellation', () => {
  const close = jest.fn(); const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  render(<AppThemeProvider><PhotoCamera onClose={close} onCapture={jest.fn()} /></AppThemeProvider>);
  expect(screen.getByText(/Camera access was denied/)).toBeTruthy();
  fireEvent.press(screen.getByText('Open device settings')); expect(settings).toHaveBeenCalled();
  fireEvent.press(screen.getByText('Cancel camera')); expect(close).toHaveBeenCalled(); settings.mockRestore();
});
it('states that missing measurement values are unavailable, not zero change', () => {
  const photo: ProgressPhoto = { id: 'photo', userId: 'owner', photoPath: 'owner/photo/full.jpg', thumbnailPath: null, pose: 'front', takenAt: '2020-01-01', notes: '', status: 'ready', checksum: null };
  render(<AppThemeProvider><PhotoComparisonValues units="metric" comparison={{ before: photo, after: { ...photo, id: 'after' }, days: 30, beforeMeasurements: null, afterMeasurements: null }} /></AppThemeProvider>);
  expect(screen.getByText('Body weight · Not recorded on both dates')).toBeTruthy();
});
