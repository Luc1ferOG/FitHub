import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button, Card } from '@/components/ui';
import { EmptyState, ErrorState, LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { getErrorMessage, isUnavailableRecord } from '@/utils/errors';
import { usePublicProfile } from '../hooks/use-social';
import { FriendActions } from '../components/friend-actions';
import { isUuid } from '@/validation/uuid';

export function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>(); const target = typeof id === 'string' ? id : ''; const query = usePublicProfile(target); const theme = useAppTheme();
  if (!isUuid(target)) return <Screen><EmptyState title="Invalid profile link" description="This profile identifier is invalid." actionLabel="Go home" onAction={() => router.replace('/(tabs)/home')} /></Screen>;
  if (isUnavailableRecord(query.error)) return <Screen><EmptyState title="Profile unavailable" description="This profile was deleted or is no longer available." actionLabel="Go home" onAction={() => router.replace('/(tabs)/home')} /></Screen>;
  if (query.isPending && target) return <Screen><LoadingIndicator /></Screen>;
  if (!query.data) return <Screen><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{query.error ? getErrorMessage(query.error) : 'This profile is unavailable.'}</Text><Button label="Retry profile" onPress={() => { void query.refetch(); }} /></Screen>;
  const profile = query.data;
  return <Screen scroll contentStyle={{ gap: 16 }}><Card style={{ gap: 12 }}>
    {query.error ? <ErrorState title="Could not refresh profile" message="Showing the last loaded profile. Try again when connected." onRetry={() => { void query.refetch(); }} /> : null}
    {profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} contentFit="cover" cachePolicy="memory-disk" accessibilityLabel={`${profile.displayName}'s avatar`} accessible style={{ width: 88, height: 88, borderRadius: 44 }} /> : null}
    <Text accessibilityRole="header" style={[theme.typography.heading, { color: theme.colors.text }]}>{profile.displayName}</Text>
    <Text style={{ color: theme.colors.textMuted }}>@{profile.username} · {profile.experienceLevel}</Text>
    <Text style={[theme.typography.body, { color: theme.colors.text }]}>{profile.bio || 'No bio yet.'}</Text>
    <FriendActions target={target} />
  </Card><Card style={{ gap: 8 }}><Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>Public statistics</Text>
    <Text style={{ color: theme.colors.text }}>{profile.publicWorkoutCount} public workout templates · {profile.achievementCount} achievements</Text>
    <Text style={{ color: theme.colors.textMuted }}>Private workout history and measurements are never shown here.</Text>
  </Card><Card style={{ gap: 12 }}><Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>Achievements</Text>
    {profile.achievements.length ? profile.achievements.map((achievement) => <View key={achievement.code}><Text accessibilityLabel={`Achievement: ${achievement.title}`} style={{ color: theme.colors.text }}>{achievement.title}</Text><Text style={{ color: theme.colors.textMuted }}>Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}</Text></View>) : <Text style={{ color: theme.colors.textMuted }}>No achievements unlocked yet.</Text>}
    {profile.achievementCount > 50 ? <Text style={{ color: theme.colors.textMuted }}>Showing the 50 most recent achievements.</Text> : null}
  </Card></Screen>;
}
