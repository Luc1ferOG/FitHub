import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

export function ExerciseSkeleton({ detail = false }: { detail?: boolean }) {
  const theme = useAppTheme();
  return (
    <View accessible accessibilityState={{ busy: true }} accessibilityLabel={detail ? 'Loading exercise guide' : 'Loading exercises'} accessibilityRole="progressbar" style={styles.container}>
      {Array.from({ length: detail ? 3 : 5 }, (_, index) => (
        <View key={index} style={[styles.row, { backgroundColor: theme.colors.surface }]}>
          <View style={[detail ? styles.hero : styles.thumbnail, { backgroundColor: theme.colors.surfaceMuted }]} />
          <View style={styles.lines}>
            <View style={[styles.line, { backgroundColor: theme.colors.surfaceMuted }]} />
            <View style={[styles.shortLine, { backgroundColor: theme.colors.surfaceMuted }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16 },
  thumbnail: { height: 72, width: 72, borderRadius: 12 },
  hero: { height: 120, width: 80, borderRadius: 12 },
  lines: { flex: 1, gap: 12 },
  line: { height: 18, width: '85%', borderRadius: 6 },
  shortLine: { height: 14, width: '60%', borderRadius: 6 },
});
