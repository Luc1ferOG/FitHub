import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/features/auth/context/auth-context';
import { useAppTheme } from '@/theme';
import { sessionStore, useSessionStore } from '../state/session-store';

export function ResumeWorkoutCard() {
  const { user } = useAuth();
  const router = useRouter();
  const theme = useAppTheme();
  const sessions = useSessionStore((state) => state.sessions);
  const hydrated = useSessionStore((state) => state.hydrated);
  const storageError = useSessionStore((state) => state.storageError);
  if (!user) return null;
  if (!hydrated) return <Button label={storageError ? 'Retry saved workout restoration' : 'Restoring saved workouts…'} variant="secondary" onPress={() => sessionStore.getState().restore()} />;
  const owned = sessions.filter((session) => session.userId === user.id);
  const current = owned.find((session) => session.submittedAt === null);
  const pending = owned.filter((session) => session.submittedAt !== null && session.syncStatus !== 'synced');
  const latest = [...owned].reverse().find((session) => session.submittedAt !== null);
  if (!current && !pending.length && !latest) return null;
  const open = (id: string) => router.push({ pathname: '/workouts/active/[sessionId]', params: { sessionId: id } });
  return <Card><View style={{ gap: 12 }}>
    {current ? <Button label={`Resume ${current.name}`} onPress={() => open(current.id)} /> : null}
    {pending.length ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>{pending.length} workout{pending.length === 1 ? '' : 's'} saved locally, waiting to synchronize.</Text> : null}
    {pending.slice(0, 3).map((session) => <Button key={session.id} label={`View ${session.name}${session.syncStatus === 'failed' ? ' · Sync needs retry' : ' · Pending sync'}`} variant="secondary" onPress={() => open(session.id)} />)}
    {latest?.syncStatus === 'synced' ? <Button label="View last workout summary" variant="ghost" onPress={() => open(latest.id)} /> : null}
    <Button label="View all saved workout sessions" variant="ghost" onPress={() => router.push('/workouts/history')} />
  </View></Card>;
}
