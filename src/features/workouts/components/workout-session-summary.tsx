import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Card, Input } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { ActiveWorkoutSession, SessionAction, SessionRecord, SessionTotals } from '../types/workout-session';
import { useSessionLifecycle } from './session-lifecycle-provider';
import { formatDuration } from './rest-timer';

export function WorkoutSessionSummary({ session, totals, records, onAction, onDone }: { session: ActiveWorkoutSession; totals: SessionTotals; records: SessionRecord[]; onAction: (action: SessionAction) => void; onDone: () => void }) {
  const theme = useAppTheme();
  const { syncing, retrySync } = useSessionLifecycle();
  const confirmed = session.receipt;
  const values = confirmed ?? totals;
  const submitted = session.submittedAt !== null;
  return <View style={{ gap: 16 }}>
    <Text accessibilityRole="header" style={[theme.typography.heading, { color: theme.colors.text }]}>{submitted ? 'Workout saved' : 'Review your workout'}</Text>
    <Card><View style={{ gap: 8 }}>{[
      ['Duration', formatDuration(values.durationSeconds)], ['Completed sets', values.totalSets], ['Total reps', values.totalReps],
      ['Weight volume', `${values.volume.toFixed(2)} kg·reps`], ['Exercises completed', `${values.exercisesCompleted} / ${session.exercises.length}`],
    ].map(([label, value]) => <Text key={String(label)} style={[theme.typography.body, { color: theme.colors.text }]}>{label}: {value}</Text>)}</View></Card>
    <Text style={[theme.typography.title, { color: theme.colors.text }]}>{confirmed ? 'Personal records' : 'Provisional personal records'}: {(confirmed?.personalRecords ?? records).length}</Text>
    {(confirmed?.personalRecords ?? records).map((record, index) => <Text key={index} style={{ color: theme.colors.text }}>{record.exerciseName}, set {record.setNumber}: {record.volume} kg·reps</Text>)}
    <Text style={{ color: theme.colors.textMuted }}>PR means a new single-set weight × reps volume record. Local candidates are confirmed during synchronization.</Text>
    <Text style={[theme.typography.title, { color: theme.colors.text }]}>Achievements unlocked</Text>
    {confirmed ? confirmed.achievements.length ? confirmed.achievements.map((item) => <Text key={item.code} style={{ color: theme.colors.text }}>{item.title}</Text>) : <Text style={{ color: theme.colors.textMuted }}>No new achievements this workout.</Text> : <Text style={{ color: theme.colors.textMuted }}>Awaiting synchronization; achievements are evaluated by the server.</Text>}
    <Text style={[theme.typography.title, { color: theme.colors.text }]}>Challenge progress changes</Text>
    {confirmed ? confirmed.challengeChanges.length ? confirmed.challengeChanges.map((item) => <Text key={item.id} style={{ color: theme.colors.text }}>{item.title}: +{item.value}</Text>) : <Text style={{ color: theme.colors.textMuted }}>No qualifying active challenges.</Text> : <Text style={{ color: theme.colors.textMuted }}>Challenge changes will appear after synchronization.</Text>}
    <Input label="Workout notes" value={session.notes} multiline maxLength={4000} editable={!submitted} onChangeText={(value) => onAction({ type: 'notes', value })} />
    {!submitted ? <>
      <Button label="Save workout" onPress={() => onAction({ type: 'submit', now: Date.now() })} />
      <Button label="Resume logging" variant="secondary" onPress={() => onAction({ type: 'resume' })} />
    </> : <>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>{session.syncStatus === 'synced' ? 'Synchronized successfully.' : syncing ? 'Saved on this device. Synchronizing…' : 'Saved on this device. Pending synchronization.'}</Text>
      {session.syncError ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{session.syncError}</Text> : null}
      {session.syncStatus !== 'synced' ? <Button label="Retry synchronization" loading={syncing} variant="secondary" onPress={() => void retrySync()} /> : null}
      <Button label="Back to home" onPress={onDone} />
    </>}
  </View>;
}
