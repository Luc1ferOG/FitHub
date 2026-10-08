import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Card, MotionView, ProgressBar } from '@/components/ui';
import { useAuth } from '@/features/auth/context/auth-context';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { useChallengeAction } from '../hooks/use-challenges';
import { displayChallengeValue, METRIC_LABELS, progressPercent } from '../services/challenge-rules';
import type { ChallengeDetails, RealtimeState } from '../types/fitness-challenge';
import { InviteFriendsPicker } from './invite-friends-picker';
export function ChallengeSummary({ details,realtime,showLeaderboardHeading = true }: { details:ChallengeDetails; realtime:RealtimeState; showLeaderboardHeading?:boolean }) {
  const { challenge,membership } = details; const { user } = useAuth(); const router = useRouter(); const theme = useAppTheme(); const action = useChallengeAction(challenge.id); const [inviting,setInviting] = useState(false);
  const member = membership !== null && membership.leftAt === null; const value = member ? (membership?.currentValue ?? 0) : 0; const percent = progressPercent(value,challenge.target);
  const open = challenge.status === 'active' && new Date().toISOString().slice(0,10) <= challenge.endDate;
  const canJoin = challenge.visibility === 'public' || challenge.visibility === 'friends' || challenge.creatorId === user?.id;
  return <View style={{ gap:12,marginBottom:12 }}><MotionView visible={member}><Card style={{ gap:12 }}><Text accessibilityRole="header" style={[theme.typography.heading,{ color:theme.colors.text }]}>{challenge.title}</Text>
    <Text style={{ color:theme.colors.text }}>{challenge.description || 'Build consistency together.'}</Text><Button label={`Created by ${details.creator.displayName}`} variant="ghost" onPress={() => router.push({ pathname:'/user/[id]',params:{ id:details.creator.id } })} />
    <Text style={{ color:theme.colors.textMuted }}>{METRIC_LABELS[challenge.metric]}{details.exerciseName ? ` · ${details.exerciseName}` : ''} · Target {displayChallengeValue(challenge.metric,challenge.target)}</Text>
    <Text style={{ color:theme.colors.textMuted }}>{challenge.startDate} through {challenge.endDate} (UTC, inclusive) · {challenge.status}</Text>
    <Text style={{ color:theme.colors.text }}>{details.participantCount} participants · {member ? `Your position: #${membership?.rank ?? '—'}` : 'Not participating'}</Text>
    {member ? <><Text accessibilityLiveRegion="polite" style={{ color:theme.colors.text }}>{displayChallengeValue(challenge.metric,value)} / {displayChallengeValue(challenge.metric,challenge.target)}{membership?.completed ? ' · Target reached!' : ''}</Text><ProgressBar value={percent} label="Challenge progress" /><Button label="Leave challenge" variant="secondary" disabled={action.isPending} onPress={() => Alert.alert('Leave challenge?','Your logged progress is retained to prevent duplicate scoring. You will no longer appear on the leaderboard.',[{ text:'Stay',style:'cancel' },{ text:'Leave',style:'destructive',onPress:() => action.mutate({ action:'leave' }) }])} /></> : open && details.invited ? <><Button label="Accept invite" loading={action.isPending} onPress={() => action.mutate({ action:'accept' })} /><Button label="Decline invite" disabled={action.isPending} variant="ghost" onPress={() => action.mutate({ action:'decline' })} /></> : open && canJoin ? <Button label="Join challenge" loading={action.isPending} onPress={() => action.mutate({ action:'join' })} /> : null}
    {challenge.creatorId === user?.id && open ? <Button label="Invite friends" variant="secondary" onPress={() => setInviting(true)} /> : null}
    {action.error ? <Text accessibilityRole="alert" style={{ color:theme.colors.danger }}>{getErrorMessage(action.error)}</Text> : null}
    <Text style={{ color:theme.colors.textMuted }}>Progress is calculated from saved workouts, never manually entered.</Text>
  </Card></MotionView>{showLeaderboardHeading ? <><Text accessibilityRole="header" style={[theme.typography.title,{ color:theme.colors.text }]}>Leaderboard</Text><Text accessibilityLiveRegion="polite" style={{ color:theme.colors.textMuted }}>{realtime === 'connected' ? 'Live updates connected' : realtime === 'connecting' ? 'Connecting live updates…' : 'Live updates reconnecting; periodic refresh remains enabled.'}</Text></>:null}
    {inviting ? <InviteFriendsPicker challengeId={challenge.id} onClose={() => setInviting(false)} /> : null}
  </View>;
}
