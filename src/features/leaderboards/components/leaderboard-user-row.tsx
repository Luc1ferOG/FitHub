import { memo } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { ChallengeMetric } from '@/types/database';
import type { RankedUser } from '../types/leaderboard';
import { completionPercent,leaderboardAmount,leaderboardLabel,leaderboardUnit } from '../services/leaderboard-presentation';
import { LeaderboardAvatar } from './leaderboard-avatar';
export const LeaderboardUserRow = memo(function LeaderboardUserRow({ entry,metric,target,currentUserId }:{ entry:RankedUser; metric:ChallengeMetric; target:number|null; currentUserId:string }) {
  const theme = useAppTheme(); const { compact } = useResponsiveLayout(); const isMe = entry.userId === currentUserId; const percentage = completionPercent(entry.value,target);
  return <View accessible accessibilityLabel={leaderboardLabel(entry,metric,target,isMe)} style={{ padding:16,gap:12,flexDirection:compact ? 'column':'row',alignItems:compact ? 'flex-start':'center',borderWidth:isMe ? 2:1,borderColor:isMe ? theme.colors.primary:theme.colors.border,borderRadius:theme.radius.md,backgroundColor:theme.colors.surface }}>
    <Text style={[theme.typography.title,{ color:theme.colors.text,minWidth:32 }]}>#{entry.rank}</Text>
    <LeaderboardAvatar uri={entry.avatarUrl} name={entry.displayName} userId={entry.userId} />
    <View style={{ flex:compact ? 0:1,minWidth:0,gap:4 }}><Text style={[theme.typography.title,{ color:theme.colors.text }]}>{entry.displayName}{isMe ? ' (You)':''}</Text>
      <Text style={{ color:theme.colors.textMuted }}>@{entry.username}</Text>
      <Text style={{ color:theme.colors.text }}>{leaderboardAmount(metric,entry.value)}{target !== null ? ` / ${leaderboardAmount(metric,target)}`:''} {leaderboardUnit(metric)}</Text>
      {percentage !== null ? <Text style={{ color:theme.colors.textMuted }}>{Math.round(percentage)}% completed</Text>:null}
    </View>
  </View>;
});
