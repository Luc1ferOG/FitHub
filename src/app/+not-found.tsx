import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/feedback';
import { Screen } from '@/components/layout/screen';

export default function NotFoundRoute() {
  const router = useRouter();

  return (
    <Screen>
      <EmptyState
        title="Page not found"
        description="The page may have moved or the link may be invalid."
        actionLabel="Go home"
        onAction={() => router.replace('/(tabs)/home')}
      />
    </Screen>
  );
}
