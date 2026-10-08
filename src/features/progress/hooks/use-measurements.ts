import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/auth-context';
import type { MeasurementInput, ProgressPeriod } from '../types/measurement';
import { measurementService } from '../services/measurement-dependencies';
import { localDate } from '../services/measurement-rules';
import { photoKeys } from '../services/photo-query-keys';
export const measurementKeys = {
  root: (owner: string) => ['body-progress', owner] as const,
  history: (owner: string) => [...measurementKeys.root(owner), 'history'] as const,
  detail: (owner: string, id: string) => [...measurementKeys.root(owner), 'entry', id] as const,
  dashboard: (owner: string, period: ProgressPeriod) => [...measurementKeys.root(owner), 'dashboard', period, localDate()] as const,
  units: (owner: string) => [...measurementKeys.root(owner), 'units'] as const,
};
const privateQuery = { meta: { persist: false } };
export function useMeasurements() {
  const { user } = useAuth(); const owner = user?.id ?? '';
  return useInfiniteQuery({ ...privateQuery, queryKey: measurementKeys.history(owner), enabled: Boolean(user), initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => measurementService.list(owner, pageParam, signal),
    getNextPageParam: (page) => page.nextOffset ?? undefined });
}
export function useMeasurement(id: string | undefined) {
  const { user } = useAuth(); const owner = user?.id ?? '';
  return useQuery({ ...privateQuery, queryKey: measurementKeys.detail(owner, id ?? ''), enabled: Boolean(user && id),
    queryFn: ({ signal }) => measurementService.get(owner, id ?? '', signal) });
}
export function useProgressDashboard(period: ProgressPeriod) {
  const { user } = useAuth();
  return useQuery({ ...privateQuery, queryKey: measurementKeys.dashboard(user?.id ?? '', period), enabled: Boolean(user),
    queryFn: ({ signal }) => measurementService.dashboard(period, signal) });
}
export function useMeasurementUnits() {
  const { user } = useAuth();
  return useQuery({ ...privateQuery, queryKey: measurementKeys.units(user?.id ?? ''), enabled: Boolean(user),
    queryFn: ({ signal }) => measurementService.preferredUnits(user?.id ?? '', signal) });
}
export function useMeasurementMutations() {
  const { user } = useAuth(); const owner = user?.id ?? ''; const client = useQueryClient();
  // Server-confirmed writes: no speculative health data or retrying non-idempotent inserts.
  const refresh = async () => {
    await client.cancelQueries({ queryKey: measurementKeys.root(owner) });
    await client.cancelQueries({ queryKey: photoKeys.comparisons(owner) });
    await Promise.all([client.invalidateQueries({ queryKey: measurementKeys.root(owner) }), client.invalidateQueries({ queryKey: photoKeys.comparisons(owner) })]);
  };
  const save = useMutation({ meta: { persist: false }, retry: false, mutationFn: ({ input, id }: { input: MeasurementInput; id?: string }) => measurementService.save(owner, input, id), onSuccess: refresh });
  const remove = useMutation({ meta: { persist: false }, retry: false, mutationFn: (id: string) => measurementService.remove(owner, id), onSuccess: refresh });
  return { save, remove };
}
