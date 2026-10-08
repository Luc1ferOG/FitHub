import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button } from '@/components/ui';
import { LoadingIndicator, EmptyState } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';

export function SocialListFeedback({ loading, error, title, description, retry }: { loading: boolean; error: Error | null; title: string; description: string; retry: () => void }) {
  const theme = useAppTheme();
  if (loading) return <LoadingIndicator />;
  if (error) return <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{getErrorMessage(error)}</Text><Button label="Retry" onPress={retry} /></View>;
  return <EmptyState title={title} description={description} />;
}
