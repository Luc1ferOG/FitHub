import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { EmptyState } from '@/components/feedback';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui';
import { AppError } from '@/domain/errors/app-error';
import { useAppTheme } from '@/theme';

import { ExerciseGuide } from '../components/exercise-guide';
import { ExerciseSkeleton } from '../components/exercise-skeleton';
import { ExerciseVideo } from '../components/exercise-video';
import { useExercise } from '../hooks/use-exercises';

export function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const query = useExercise(exerciseId);
  const theme = useAppTheme();
  const exercise = query.data;

  if (!exercise) {
    const notFound = query.error instanceof AppError && query.error.code === 'NOT_FOUND';
    return (
      <Screen scroll>
        <Stack.Screen options={{ title: 'Exercise guide' }} />
        {query.isPending ? <ExerciseSkeleton detail /> : (
          <EmptyState title={notFound ? 'Exercise not found' : 'Could not load the guide'}
            description={notFound ? 'This exercise is no longer available.' : 'Check your connection and try again.'}
            actionLabel="Retry" onAction={() => void query.refetch()} />
        )}
        {query.fetchStatus === 'paused' ? <Text style={{ color: theme.colors.textMuted }}>Connect to the internet to load this guide.</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Stack.Screen options={{ title: exercise.name }} />
      <Text accessibilityRole="header" style={[theme.typography.heading, { color: theme.colors.text }]}>{exercise.name}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{exercise.description}</Text>
      <Card style={styles.metadata}>
        <Metadata label="Primary muscle" value={exercise.primaryMuscle} />
        <Metadata label="Secondary muscles" value={exercise.secondaryMuscles.join(', ') || 'None listed'} />
        <Metadata label="Equipment" value={exercise.equipment} />
        <Metadata label="Difficulty" value={exercise.difficulty} />
      </Card>
      <Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>Video tutorial</Text>
      <ExerciseVideo key={exercise.id} url={exercise.videoUrl} name={exercise.name} />
      <ExerciseGuide title="Instructions" entries={exercise.instructions} numbered />
      <ExerciseGuide title="Form tips" entries={exercise.formTips} />
      <ExerciseGuide title="Common mistakes" entries={exercise.commonMistakes} />
    </Screen>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return <Text accessibilityLabel={`${label}: ${value}`} style={[theme.typography.body, { color: theme.colors.text }]}>{label}: {value}</Text>;
}

const styles = StyleSheet.create({
  content: { gap: 24 },
  metadata: { gap: 8 },
});
