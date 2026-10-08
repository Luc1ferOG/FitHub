import { SectionList, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { LoadingIndicator } from '@/components/feedback/loading-indicator';
import { EmptyState } from '@/components/feedback/empty-state';
import { useAppTheme } from '@/theme';
import { useAchievements } from '../hooks/use-achievements';
import { AchievementCard } from '../components/achievement-card';
export function AchievementsScreen() {
  const theme = useAppTheme(); const board = useAchievements();
  if (board.isPending) return <Screen><LoadingIndicator label="Loading achievements" /></Screen>;
  if (board.isError && !board.data) return <Screen><EmptyState title="Achievements unavailable" description="Check your connection and try again." /><Button label="Retry" onPress={() => { void board.refetch(); }} /></Screen>;
  const entries = board.data?.entries ?? [];
  const sections = [{ title: 'Unlocked', data: entries.filter((a) => a.unlockedAt !== null) }, { title: 'Locked', data: entries.filter((a) => a.unlockedAt === null) }];
  return <Screen contentStyle={{ flex: 1 }}>
    <SectionList sections={sections} keyExtractor={(item) => item.id}
      renderItem={({ item }) => <AchievementCard achievement={item} />}
      renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text, backgroundColor: theme.colors.background, paddingVertical: 12 }]}>{section.title} · {section.data.length}</Text>}
      renderSectionFooter={({ section }) => section.title === 'Unlocked' && section.data.length === 0 ? <EmptyState title="Your first badge awaits" description="Complete a workout, make a friend, or join a challenge." /> : null}
      ListHeaderComponent={<View style={{ gap: 8 }}><Text style={[theme.typography.heading, { color: theme.colors.text }]}>Your milestones</Text><Text style={{ color: theme.colors.textMuted }}>Progress counts confirmed workouts. Offline sessions count after synchronization. Streaks use UTC dates.</Text>{board.isError ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>Could not refresh. Showing your last loaded progress.</Text> : null}</View>}
      refreshing={board.isRefetching} onRefresh={() => { void board.refetch(); }} initialNumToRender={8} windowSize={5} stickySectionHeadersEnabled />
  </Screen>;
}
