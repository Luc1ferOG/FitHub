import { useWindowDimensions } from 'react-native';
import { isCompactLayout } from '@/utils/responsive';
export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  return { width, height, fontScale, compact: isCompactLayout(width, fontScale) };
}
