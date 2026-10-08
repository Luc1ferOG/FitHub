import { memo } from 'react';
import { Pressable } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme';
import { displayChallengeValue, METRIC_LABELS } from '../services/challenge-rules';
import type { FitnessChallenge } from '../types/fitness-challenge';
export const ChallengeCard = memo(function ChallengeCard({ challenge,onPress }: { challenge:FitnessChallenge; onPress:(id:string) => void }) {
  const theme = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${challenge.title}. ${METRIC_LABELS[challenge.metric]}, target ${displayChallengeValue(challenge.metric,challenge.target)}. ${challenge.status}`} onPress={() => onPress(challenge.id)} style={{ padding:16,gap:8,minHeight:72,backgroundColor:theme.colors.surface,borderRadius:theme.radius.lg,borderWidth:1,borderColor:theme.colors.border }}>
    <Text style={[theme.typography.title,{ color:theme.colors.text }]}>{challenge.title}</Text>
    <Text style={{ color:theme.colors.textMuted }}>{METRIC_LABELS[challenge.metric]} · {displayChallengeValue(challenge.metric,challenge.target)}</Text>
    <Text style={{ color:theme.colors.textMuted }}>{challenge.startDate} – {challenge.endDate} · {challenge.visibility === 'private' ? 'Invite only' : challenge.visibility} · {challenge.status}</Text>
  </Pressable>;
});
