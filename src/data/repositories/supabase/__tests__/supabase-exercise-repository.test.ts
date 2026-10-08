import { supabase } from '@/lib/supabase';

import { DEFAULT_EXERCISE_FILTERS } from '@/features/exercises/services/exercise-service';
import { EXERCISE_SUMMARY_COLUMNS, escapeExerciseSearch, SupabaseExerciseRepository } from '../supabase-exercise-repository';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const row = {
  id: '10000000-0000-0000-0000-000000000001', name: 'Back Squat',
  primary_muscle: 'quadriceps', equipment: 'barbell', difficulty: 'intermediate', thumbnail_url: null,
};

function mockQuery(data: unknown, error: unknown = null) {
  const response = { data, error };
  const builder = {
    select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(response),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  };
  jest.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);
  return builder;
}

describe('SupabaseExerciseRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a bounded summary projection, literal search, and all three filters', async () => {
    const builder = mockQuery([row]);
    const signal = new AbortController().signal;
    const page = await new SupabaseExerciseRepository().list({
      search: 'squat_10%', muscle: 'quadriceps', equipment: 'barbell', difficulty: 'intermediate',
    }, 20, 20, signal);
    expect(supabase.from).toHaveBeenCalledWith('exercises');
    expect(builder.select).toHaveBeenCalledWith(EXERCISE_SUMMARY_COLUMNS);
    expect(builder.ilike).toHaveBeenCalledWith('name', '%squat\\_10\\%%');
    expect(builder.eq.mock.calls).toEqual([
      ['primary_muscle', 'quadriceps'], ['equipment', 'barbell'], ['difficulty', 'intermediate'],
    ]);
    expect(builder.order.mock.calls).toEqual([['name', { ascending: true }], ['id', { ascending: true }]]);
    expect(builder.range).toHaveBeenCalledWith(20, 40);
    expect(builder.abortSignal).toHaveBeenCalledWith(signal);
    expect(page.items[0]).toMatchObject({ name: 'Back Squat', primaryMuscle: 'quadriceps' });
    expect(page.nextOffset).toBeNull();
  });

  it('returns twenty items and a next offset only when a lookahead row exists', async () => {
    mockQuery(Array.from({ length: 21 }, (_, index) => ({ ...row, id: String(index) })));
    const page = await new SupabaseExerciseRepository().list(DEFAULT_EXERCISE_FILTERS, 0, 20);
    expect(page.items).toHaveLength(20);
    expect(page.nextOffset).toBe(20);
  });

  it('does not apply empty filters or request a second empty page', async () => {
    const builder = mockQuery(Array.from({ length: 20 }, () => row));
    const page = await new SupabaseExerciseRepository().list(DEFAULT_EXERCISE_FILTERS, 0, 20);
    expect(builder.eq).not.toHaveBeenCalled();
    expect(builder.ilike).not.toHaveBeenCalled();
    expect(page.nextOffset).toBeNull();
  });

  it('maps detail-only coaching and video fields', async () => {
    const builder = mockQuery({ ...row, description: 'Squat guide', secondary_muscles: ['glutes'],
      instructions: ['Brace'], form_tips: ['Stay balanced'], common_mistakes: ['Knees collapsing'],
      video_url: 'https://example.com/squat.mp4', created_at: '2026-10-06T00:00:00Z' });
    const exercise = await new SupabaseExerciseRepository().findById(row.id);
    expect(builder.eq).toHaveBeenCalledWith('id', row.id);
    expect(exercise).toMatchObject({ formTips: ['Stay balanced'], commonMistakes: ['Knees collapsing'] });
  });

  it('normalizes backend failures into application errors', async () => {
    mockQuery(null, { message: 'Network error' });
    await expect(new SupabaseExerciseRepository().list(DEFAULT_EXERCISE_FILTERS, 0, 20))
      .rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('escapes backslashes and wildcard characters', () => {
    expect(escapeExerciseSearch('a\\b_%')).toBe('a\\\\b\\_\\%');
  });
});
