import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { AppError } from '@/domain/errors/app-error';

import { exerciseService } from '../services/exercise-dependencies';
import { normalizeExerciseFilters } from '../services/exercise-service';
import type { ExerciseFilters } from '../types/exercise';

export const exerciseKeys = {
  all: ['exercises'] as const,
  list: (filters: ExerciseFilters) => ['exercises', 'list', normalizeExerciseFilters(filters)] as const,
  detail: (id: string) => ['exercises', 'detail', id] as const,
  filterOptions: ['exercises', 'filter-options'] as const,
};

export function useExercises(filters: ExerciseFilters) {
  const normalized = normalizeExerciseFilters(filters);
  return useInfiniteQuery({
    queryKey: exerciseKeys.list(normalized),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => exerciseService.list(normalized, pageParam, signal),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    meta: { persist: false },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: ({ signal }) => exerciseService.requireExercise(id, signal),
    staleTime: 30 * 60_000,
    retry: (failureCount, error) => failureCount < 2 && !(error instanceof AppError && error.code === 'NOT_FOUND'),
  });
}

export function useExerciseFilterOptions() {
  return useQuery({
    queryKey: exerciseKeys.filterOptions,
    queryFn: ({ signal }) => exerciseService.getFilterOptions(signal),
    staleTime: 60 * 60_000,
  });
}
