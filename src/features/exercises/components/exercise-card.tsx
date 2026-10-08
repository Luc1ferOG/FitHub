import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { useAppTheme } from '@/theme';

import type { ExerciseSummary } from '../types/exercise';

type ExerciseCardProps = {
  exercise: ExerciseSummary;
  onSelect: (id: string) => void;
  accessibilityHint?: string;
};

export const ExerciseCard = memo(function ExerciseCard({ exercise, onSelect, accessibilityHint = 'Opens instructions and the video tutorial' }: ExerciseCardProps) {
  const theme = useAppTheme();
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}. Primary muscle: ${exercise.primaryMuscle}. Equipment: ${exercise.equipment}. Difficulty: ${exercise.difficulty}.`}
      accessibilityHint={accessibilityHint}
      onPress={() => onSelect(exercise.id)}
      style={({ pressed }) => [styles.card, {
        backgroundColor: theme.colors.surface, borderColor: theme.colors.border,
        borderRadius: theme.radius.lg, opacity: pressed ? 0.75 : 1,
      }]}
    >
      <View style={[styles.thumbnail, { backgroundColor: theme.colors.surfaceMuted }]} accessible={false}>
        {exercise.thumbnailUrl && failedThumbnail !== exercise.thumbnailUrl ? (
          <Image
            source={{ uri: exercise.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            enforceEarlyResizing
            cachePolicy="memory-disk"
            recyclingKey={exercise.id}
            transition={120}
            accessible={false}
            onError={() => setFailedThumbnail(exercise.thumbnailUrl)}
          />
        ) : <Ionicons name="barbell-outline" size={30} color={theme.colors.textMuted} />}
      </View>
      <View style={styles.content} accessible={false}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>{exercise.name}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {exercise.primaryMuscle} · {exercise.equipment}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>{exercise.difficulty}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} accessible={false} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, gap: 12, minHeight: 104 },
  thumbnail: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 4 },
});
