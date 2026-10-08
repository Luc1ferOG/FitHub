import { memo } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { SessionHistoryItem } from '../services/session-history-selector';

export const SessionHistoryRow = memo(function SessionHistoryRow({ item, onOpen }: {
  item: SessionHistoryItem; onOpen: (id: string) => void;
}) {
  const theme = useAppTheme();
  return <Card><View style={{ gap: theme.spacing.sm }}>
    <Text style={[theme.typography.title, { color: theme.colors.text }]}>{item.name}</Text>
    <Text style={{ color: theme.colors.textMuted }}>{item.submittedAt === null ? 'In progress' : item.syncStatus === 'synced' ? 'Synchronized' : item.syncStatus === 'failed' ? 'Saved locally · Sync needs retry' : 'Saved locally · Pending synchronization'}</Text>
    <Button label={`Open ${item.name}`} variant="secondary" onPress={() => onOpen(item.id)} />
  </View></Card>;
});
