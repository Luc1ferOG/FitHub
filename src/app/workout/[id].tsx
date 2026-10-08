import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export default function WorkoutDeepLinkRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const href = `/workouts/${encodeURIComponent(id)}` as Href;
  return <Redirect href={href} />;
}
