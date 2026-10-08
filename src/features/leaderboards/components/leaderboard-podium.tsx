import { memo } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { ChallengeMetric } from '@/types/database';
import type { RankedUser } from '../types/leaderboard';
import { leaderboardLabel,leaderboardAmount,leaderboardUnit } from '../services/leaderboard-presentation';
import { LeaderboardAvatar } from './leaderboard-avatar';
export const LeaderboardPodium = memo(function LeaderboardPodium({ entries,metric,target,currentUserId }:{ entries:readonly RankedUser[]; metric:ChallengeMetric; target:number|null; currentUserId:string }) {
  const theme = useAppTheme(); const { compact } = useResponsiveLayout(); if (!entries.length) return null;
  // Presentation only: SQL supplies the top three entries and their true tied ranks.
  const podium = entries.slice(0,3); const display = !compact && podium.length === 3 ? [podium[1],podium[0],podium[2]]:podium;
  return <View style={{ gap:8 }}><Text accessibilityRole="header" style={[theme.typography.title,{ color:theme.colors.text }]}>Podium</Text>
    <View style={{ flexDirection:compact ? 'column':'row',alignItems:compact ? 'stretch':'flex-end',gap:8 }}>{display.map((entry)=>entry ? <View key={entry.userId} accessible accessibilityLabel={`Podium. ${leaderboardLabel(entry,metric,target,entry.userId === currentUserId)}`} style={{ flex:compact ? 0:1,minHeight:entry.rank === 1 ? 172:entry.rank === 2 ? 152:136,padding:8,gap:8,alignItems:'center',justifyContent:'flex-end',backgroundColor:theme.colors.surface,borderRadius:theme.radius.md,borderWidth:entry.userId === currentUserId ? 2:1,borderColor:entry.userId === currentUserId ? theme.colors.primary:theme.colors.border }}>
      <Text style={[theme.typography.heading,{ color:theme.colors.primary }]}>#{entry.rank}</Text>
      <LeaderboardAvatar uri={entry.avatarUrl} name={entry.displayName} userId={entry.userId} size={40} />
      <Text style={[theme.typography.caption,{ textAlign:'center',color:theme.colors.text }]}>{entry.displayName}{entry.userId === currentUserId ? ' (You)':''}</Text>
      <Text style={[theme.typography.caption,{ textAlign:'center',color:theme.colors.textMuted }]}>{leaderboardAmount(metric,entry.value)} {leaderboardUnit(metric)}</Text>
    </View>:null)}</View>
    <Text style={[theme.typography.caption,{ color:theme.colors.textMuted }]}>Top three entries. Equal scores share a rank; tied users are ordered by user ID.</Text>
  </View>;
});
