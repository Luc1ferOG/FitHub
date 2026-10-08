import { StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Ionicons } from '@expo/vector-icons';
import { MotionView } from '../ui/motion-view';

import { useAppTheme } from '@/theme';

import { Button } from '../ui/button';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <MotionView style={styles.container}>
      <Ionicons name="sparkles-outline" size={32} color={theme.colors.primary} accessible={false} />
      <Text style={[theme.typography.title, { color: theme.colors.text, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textMuted, textAlign: 'center' }]}>
        {description}
      </Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </MotionView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
});
