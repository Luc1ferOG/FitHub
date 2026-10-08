import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export default function ChallengeDeepLinkRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const href = `/challenges/${encodeURIComponent(id)}` as Href;
  return <Redirect href={href} />;
}
