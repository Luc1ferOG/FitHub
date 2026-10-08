import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { useAppTheme } from '@/theme';

type LoadingIndicatorProps = {
  label?: string;
  fullScreen?: boolean;
};

export function LoadingIndicator({ label = 'Loading', fullScreen = false }: LoadingIndicatorProps) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessible
      accessibilityState={{ busy: true }}
      style={[styles.container, fullScreen && styles.fullScreen, { backgroundColor: theme.colors.background }]}
    >
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  fullScreen: {
    flex: 1,
  },
});
