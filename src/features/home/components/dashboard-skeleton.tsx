import { View } from 'react-native';
import { useAppTheme } from '@/theme';
export function DashboardSkeleton() {
  const theme = useAppTheme();
  return <View accessible accessibilityRole="text" accessibilityLabel="Loading your dashboard" accessibilityState={{ busy: true }} style={{ gap: 24 }}>
    {[96, 160, 120, 180].map((height, index) => <View key={index} importantForAccessibility="no-hide-descendants" style={{ height, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceMuted }} />)}
  </View>;
}
