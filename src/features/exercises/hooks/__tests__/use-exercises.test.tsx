import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { exerciseService } from '../../services/exercise-dependencies';
import { DEFAULT_EXERCISE_FILTERS } from '../../services/exercise-service';
import { exerciseKeys, useExercise, useExercises } from '../use-exercises';

jest.mock('../../services/exercise-dependencies', () => ({
  exerciseService: { list: jest.fn(), requireExercise: jest.fn(), getFilterOptions: jest.fn() },
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

describe('exercise queries', () => {
  beforeEach(() => jest.clearAllMocks());

  it('includes normalized search and every filter in separate cache keys', () => {
    const filters = { ...DEFAULT_EXERCISE_FILTERS, search: ' SQUAT ' };
    expect(exerciseKeys.list(filters)).toEqual(exerciseKeys.list({ ...filters, search: 'squat' }));
    for (const changed of [{ muscle: 'glutes' }, { equipment: 'barbell' }, { difficulty: 'advanced' as const }]) {
      expect(exerciseKeys.list({ ...filters, ...changed })).not.toEqual(exerciseKeys.list(filters));
    }
  });

  it('fetches successive bounded pages and starts a new sequence for changed filters', async () => {
    jest.mocked(exerciseService.list)
      .mockResolvedValueOnce({ items: [], nextOffset: 20 })
      .mockResolvedValueOnce({ items: [], nextOffset: null })
      .mockResolvedValueOnce({ items: [], nextOffset: null });
    const { Wrapper, client } = setup();
    const hook = renderHook((filters) => useExercises(filters), { initialProps: DEFAULT_EXERCISE_FILTERS, wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    await act(async () => { await hook.result.current.fetchNextPage(); });
    expect(exerciseService.list).toHaveBeenNthCalledWith(2, DEFAULT_EXERCISE_FILTERS, 20, expect.any(AbortSignal));
    hook.rerender({ ...DEFAULT_EXERCISE_FILTERS, search: 'squat', equipment: 'barbell' });
    await waitFor(() => expect(exerciseService.list).toHaveBeenCalledTimes(3));
    expect(exerciseService.list).toHaveBeenNthCalledWith(3,
      { ...DEFAULT_EXERCISE_FILTERS, search: 'squat', equipment: 'barbell' }, 0, expect.any(AbortSignal));
    hook.unmount();
    client.clear();
  });

  it('reuses a fresh cached detail instead of requesting it again', async () => {
    const { Wrapper, client } = setup();
    const detail = { id: 'exercise-1', name: 'Squat', description: '', primaryMuscle: 'quadriceps',
      equipment: 'barbell', difficulty: 'beginner' as const, thumbnailUrl: null, videoUrl: null,
      instructions: ['Brace'], secondaryMuscles: [], formTips: [], commonMistakes: [] };
    jest.mocked(exerciseService.requireExercise).mockResolvedValue(detail);
    const first = renderHook(() => useExercise(detail.id), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    const second = renderHook(() => useExercise(detail.id), { wrapper: Wrapper });
    expect(second.result.current.data).toEqual(detail);
    expect(exerciseService.requireExercise).toHaveBeenCalledTimes(1);
    second.unmount();
    client.clear();
  });
});
