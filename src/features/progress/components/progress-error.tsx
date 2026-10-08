import { ErrorState } from '@/components/feedback';
import { getErrorMessage } from '@/utils/errors';
export function ProgressError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState title="Measurements unavailable" message={getErrorMessage(error)} onRetry={retry} />;
}
