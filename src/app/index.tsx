import { Redirect } from 'expo-router';

export default function IndexRoute() {
  // Authentication routing will replace this redirect when auth state is implemented.
  return <Redirect href="/(tabs)/home" />;
}
