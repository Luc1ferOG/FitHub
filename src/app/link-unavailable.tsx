import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { EmptyState } from '@/components/feedback';

export default function LinkUnavailable() {
  const router = useRouter();
  return <Screen><EmptyState title="This link is unavailable" description="The link may be invalid, expired, or point to a deleted record." actionLabel="Go home" onAction={() => router.replace('/(tabs)/home')} /></Screen>;
}
