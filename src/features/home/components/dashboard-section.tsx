import { memo } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { useRouter } from 'expo-router';
import { Button, Card, MotionView, ProgressBar } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { displayChallengeValue } from '@/features/challenges/services/challenge-rules';
import type { HomeDashboard } from '../types/dashboard';
import { challengeRemaining, progressPercentage, volumeLabel } from '../services/dashboard-rules';

export const dashboardSections = ['today', 'quick', 'week', 'challenges', 'achievement', 'activity'] as const;
export type DashboardSectionName = typeof dashboardSections[number];
const titles: Record<DashboardSectionName, string> = { today: "Today's summary", quick: 'Quick start', week: 'This week', challenges: 'Active challenges', achievement: 'Latest achievement', activity: 'Recent activity' };

export const DashboardSection = memo(function DashboardSection({ section, dashboard, now, activeName }: {
  section: DashboardSectionName; dashboard: HomeDashboard; now: Date; activeName: string | null;
}) {
  const theme = useAppTheme(); const router = useRouter();
  const textStyle = { color: theme.colors.textMuted };
  return <MotionView style={{ gap: theme.spacing.md }}>
    <Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>{titles[section]}</Text>
    {section === 'today' ? <Card style={{ gap: 8 }}>
      <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{activeName ? `${activeName} in progress` : dashboard.today.workouts ? `${dashboard.today.workouts} workout${dashboard.today.workouts === 1 ? '' : 's'} completed` : 'Ready for your first workout today?'}</Text>
      <Text style={textStyle}>{dashboard.activeChallengeCount} active challenge{dashboard.activeChallengeCount === 1 ? '' : 's'}</Text>
    </Card> : null}
    {section === 'quick' ? <Card style={{ gap: 8 }}>
      <Button label="Start Workout" accessibilityHint="Choose a workout template to start training" onPress={() => router.push('/(tabs)/workouts')} />
      <Text style={textStyle}>Recent templates</Text>
      {dashboard.templates.length ? dashboard.templates.map((workout) => <Button key={workout.id} variant="secondary" label={`${workout.name}${workout.estimated_duration === null ? '' : ` · ${Math.round(workout.estimated_duration / 60)} min`}`} accessibilityHint="Open workout details to start this template" onPress={() => router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: workout.id } })} />) : <>
        <Text style={textStyle}>Build a template for your next session.</Text>
        <Button label="Create workout" variant="secondary" onPress={() => router.push('/workouts/create')} />
      </>}
    </Card> : null}
    {section === 'week' ? <Card style={{ gap: 8 }}>
      <Text style={textStyle}>{dashboard.week.workouts} workouts</Text>
      <Text style={textStyle}>{Math.round(dashboard.week.durationSeconds / 60).toLocaleString()} minutes training</Text>
      <Text style={textStyle}>{volumeLabel(dashboard.week.volumeKg, dashboard.profile?.units ?? 'metric')} lifted</Text>
      <Text style={textStyle}>Monday–today · synchronized workouts</Text>
    </Card> : null}
    {section === 'challenges' ? dashboard.challenges.length ? dashboard.challenges.map((challenge) => {
      const percent = progressPercentage(challenge.current_value, challenge.target_value);
      const progress = `${displayChallengeValue(challenge.metric_type, challenge.current_value)} / ${displayChallengeValue(challenge.metric_type, challenge.target_value)}`;
      const remaining = challengeRemaining(challenge.end_date, now);
      return <Card key={challenge.id} style={{ gap: 8 }}>
        <Button label={challenge.title} variant="ghost" accessibilityLabel={`${challenge.title}, ${progress}, ${percent} percent complete, ${remaining}`} onPress={() => router.push({ pathname: '/challenges/[challengeId]', params: { challengeId: challenge.id } })} />
        <Text style={textStyle}>{progress} · {remaining}</Text>
        <ProgressBar value={percent} label={`${challenge.title} progress`} />
      </Card>;
    }) : <Card><Text style={textStyle}>A little friendly competition? Join a challenge.</Text><Button label="Explore challenges" variant="ghost" onPress={() => router.push('/(tabs)/challenges')} /></Card> : null}
    {section === 'achievement' ? <Card style={{ gap: 8 }}>
      {dashboard.latestAchievement ? <>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{dashboard.latestAchievement.title}</Text>
        <Text style={textStyle}>{dashboard.latestAchievement.description}</Text>
        <Text style={textStyle}>Unlocked {new Date(dashboard.latestAchievement.unlockedAt).toLocaleDateString()}</Text>
      </> : <Text style={textStyle}>Your first milestone is ahead. Complete a workout to get started.</Text>}
      <Button label="View achievements" variant="ghost" onPress={() => router.push('/achievements')} />
    </Card> : null}
    {section === 'activity' ? <Card style={{ gap: 16 }}>
      {dashboard.activity.length ? dashboard.activity.map((item) => <View key={item.id} style={{ gap: 4 }}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={textStyle}>{item.detail} · {new Date(item.occurred_at).toLocaleDateString()}</Text>
        {item.kind === 'friend_achievement' && item.user_id ? <Button label="View friend profile" accessibilityLabel={`View profile for ${item.title}`} variant="ghost" onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.user_id ?? '' } })} /> : null}
      </View>) : <Text style={textStyle}>Workouts, friends' milestones, and challenge updates will appear here.</Text>}
      <Button label="Workout history" variant="ghost" onPress={() => router.push('/workouts/history')} />
    </Card> : null}
  </MotionView>;
});
