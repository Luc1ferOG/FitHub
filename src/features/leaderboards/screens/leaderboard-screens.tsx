import { useLocalSearchParams } from 'expo-router';
import { LeaderboardScreen } from './leaderboard-screen';
export function ChallengeLeaderboardScreen({ showDetails = false }:{ showDetails?:boolean }) {
  const { challengeId } = useLocalSearchParams<{ challengeId:string }>();
  return <LeaderboardScreen scope={{ kind:'challenge',challengeId:typeof challengeId === 'string' ? challengeId:'' }} showDetails={showDetails} />;
}
export function FriendsLeaderboardScreen() { return <LeaderboardScreen scope={{ kind:'friends' }} />; }
