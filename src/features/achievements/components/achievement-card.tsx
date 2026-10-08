import { memo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Card, ProgressBar } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { Achievement } from '../types/achievement';
import { achievementProgress, progressLabel } from '../services/achievement-rules';

export const AchievementCard = memo(function AchievementCard({ achievement }: { achievement: Achievement }) {
  const theme = useAppTheme(); const unlocked = achievement.unlockedAt !== null;
  const progress = achievementProgress(achievement);
  const date = achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : null;
  const icon = achievement.icon in Ionicons.glyphMap ? achievement.icon as keyof typeof Ionicons.glyphMap : 'trophy-outline';
  return (
    <Card style={{ gap: 8, marginBottom: 12 }} accessible accessibilityLabel={achievement.title + '. ' + achievement.description + '. ' + (unlocked ? 'Unlocked ' + date : 'Locked. ' + progressLabel(achievement))}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Ionicons name={icon} size={32} color={unlocked ? theme.colors.primary : theme.colors.textMuted} accessible={false} />
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>{achievement.title}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{achievement.category.toUpperCase()}{achievement.active ? '' : ' · LEGACY'}</Text>
        </View>
        <Ionicons name={unlocked ? 'checkmark-circle' : 'lock-closed-outline'} size={22} color={unlocked ? theme.colors.success : theme.colors.textMuted} accessible={false} />
      </View>
      <Text style={[theme.typography.body, { color: theme.colors.text }]}>{achievement.description}</Text>
      {unlocked ? <Text style={{ color: theme.colors.textMuted }}>Unlocked {date}</Text> : <>
        <Text style={{ color: theme.colors.textMuted }}>{progressLabel(achievement)}</Text>
        <ProgressBar value={progress.percent} label={`${achievement.title} progress`} />
      </>}
    </Card>
  );
});
