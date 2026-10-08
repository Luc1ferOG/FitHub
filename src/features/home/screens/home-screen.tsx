import { useCallback } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItemInfo } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { ResumeWorkoutCard } from '@/features/workouts/components/resume-workout-card';
import { useSessionStore } from '@/features/workouts/state/session-store';
import { useAuth } from '@/features/auth/context/auth-context';
import { useAppTheme } from '@/theme';
import { DashboardSection, dashboardSections, type DashboardSectionName } from '../components/dashboard-section';
import { DashboardSkeleton } from '../components/dashboard-skeleton';
import { useDashboard } from '../hooks/use-dashboard';
import { greeting } from '../services/dashboard-rules';

export function HomeScreen() {
  const theme = useAppTheme(); const { user } = useAuth(); const query = useDashboard();
  const activeName = useSessionStore((state) => state.sessions.find((session) => session.userId === user?.id && session.submittedAt === null)?.name ?? null);
  const pendingCount = useSessionStore((state) => state.sessions.filter((session) => session.userId === user?.id && session.submittedAt !== null && session.syncStatus !== 'synced').length);
  const { data, now, refetch } = query;
  const refresh = useCallback(() => { void refetch(); }, [refetch]);
  const renderSection = useCallback(({ item }: ListRenderItemInfo<DashboardSectionName>) => data ? <DashboardSection section={item} dashboard={data} now={now} activeName={activeName} /> : null, [data, now, activeName]);
  return <Screen contentStyle={{ padding: 0 }}>
    <FlatList data={data ? dashboardSections : []} keyExtractor={(item) => item} renderItem={renderSection}
      initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5}
      contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={query.isFetching && !query.isPending} onRefresh={refresh} tintColor={theme.colors.primary} />}
      ListHeaderComponent={<View style={{ gap: 16 }}>
        <Text accessibilityRole="header" style={[theme.typography.heading, { color: theme.colors.text }]}>{greeting(now.getHours())}, {data?.profile?.displayName || 'athlete'}</Text>
        <Text style={{ color: theme.colors.textMuted }}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <ResumeWorkoutCard />
        {pendingCount ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>Your {pendingCount} pending workout{pendingCount === 1 ? '' : 's'} will count toward totals after synchronization.</Text> : null}
        {query.isError ? <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{data ? 'Could not refresh. Showing your last loaded dashboard.' : 'Could not load your dashboard. Check your connection and try again.'}</Text>
          <Button label="Retry dashboard" variant="secondary" onPress={refresh} disabled={query.isFetching} />
        </View> : null}
      </View>}
      ListEmptyComponent={query.isPending ? <DashboardSkeleton /> : null}
      ListFooterComponent={data ? <Text style={{ color: theme.colors.textMuted }}>Updated {new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}. Pull down to refresh.</Text> : null}
    />
  </Screen>;
}
