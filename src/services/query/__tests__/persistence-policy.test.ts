import { dehydrate, QueryClient } from '@tanstack/react-query';
import { shouldPersistMutation } from '../persistence-policy';
import { writeInvalidationKeys } from '../write-invalidation';

it('does not serialize paused login credentials even if a caller opts into persistence', () => {
  const client = new QueryClient();
  // This synthetic paused mutation never settles; its GC timer is irrelevant to serialization.
  const mutation = client.getMutationCache().build(client, { mutationKey: ['login'], meta: { persist: true }, gcTime: Infinity,
    mutationFn: async (_input: { email: string; password: string }) => undefined });
  mutation.state = { ...mutation.state, status: 'pending', isPaused: true, variables: { email: 'alex@example.test', password: 'private-password' } };
  const snapshot = dehydrate(client, { shouldDehydrateMutation: shouldPersistMutation });
  expect(snapshot.mutations).toEqual([]); expect(JSON.stringify(snapshot)).not.toContain('private-password'); client.clear();
});
it('invalidates dependent owner aggregates without invalidating a different account', async () => {
  const client = new QueryClient(); client.setQueryData(['home-dashboard', 'owner', 'UTC', 'today'], { count: 0 });
  client.setQueryData(['home-dashboard', 'other', 'UTC', 'today'], { count: 1 });
  await Promise.all(writeInvalidationKeys('workout-session', 'owner').map((queryKey) => client.invalidateQueries({ queryKey })));
  expect(client.getQueryState(['home-dashboard', 'owner', 'UTC', 'today'])?.isInvalidated).toBe(true);
  expect(client.getQueryState(['home-dashboard', 'other', 'UTC', 'today'])?.isInvalidated).toBe(false); client.clear();
});
