import { StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme';

import { Card } from '../ui/card';
import { Screen } from './screen';

type FeaturePlaceholderProps = {
  title: string;
  description: string;
};

export function FeaturePlaceholder({ title, description }: FeaturePlaceholderProps) {
  const theme = useAppTheme();

  return (
    <Screen>
      <Card accessibilityLabel={`${title} overview`} style={styles.card}>
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{description}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
});
