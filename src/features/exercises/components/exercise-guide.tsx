import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { Card } from '@/components/ui';
import { useAppTheme } from '@/theme';

export function ExerciseGuide({ title, entries, numbered = false }: {
  title: string; entries: readonly string[]; numbered?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Card style={styles.card}>
      <Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>{title}</Text>
      {entries.length === 0 ? (
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>No {title.toLowerCase()} available yet.</Text>
      ) : entries.map((entry, index) => (
        <View key={`${index}:${entry}`} style={styles.row}>
          <Text accessible={false} style={[theme.typography.bodyStrong, { color: theme.colors.primary }]}>{numbered ? `${index + 1}.` : '•'}</Text>
          <Text accessibilityLabel={numbered ? `Step ${index + 1}: ${entry}` : entry}
            style={[theme.typography.body, styles.entry, { color: theme.colors.text }]}>{entry}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  entry: { flex: 1 },
});
