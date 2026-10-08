import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { useAppTheme } from '@/theme';
export function ErrorState({ title = 'Could not load this content', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  const theme = useAppTheme();
  return <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.danger, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }}>
    <Text accessibilityRole="alert" style={[theme.typography.title, { color: theme.colors.text }]}>{title}</Text>
    <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{message}</Text>
    {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
  </View>;
}
