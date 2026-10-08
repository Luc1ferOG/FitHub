import { AppError } from '@/domain/errors/app-error';
import type { Workout } from '@/domain/entities/workout';
import type { WorkoutRepository } from '@/features/workouts/repositories/workout-repository';
import type { WorkoutInput, WorkoutPage } from '@/features/workouts/types/workout';
import { cachedWorkoutSchema, cachedWorkoutPageSchema } from '@/features/workouts/validation/cached-workout-schema';

export interface OfflineCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  removeByPrefix(prefix: string): void;
  valuesByPrefix(prefix: string): string[];
}

/** Owner-scoped, durable read-through cache. Offline CRUD is deliberately not replayed. */
export class OfflineWorkoutRepository implements WorkoutRepository {
  constructor(private readonly remote: WorkoutRepository, private readonly cache: OfflineCacheStorage,
    private readonly userId: () => string | null, private readonly isOffline: () => boolean) {}

  private owner(): string {
    const owner = this.userId();
    if (!owner) throw new AppError('Sign in to access saved workouts.', 'AUTHENTICATION');
    return owner;
  }
  private key(owner: string, suffix: string): string { return `workouts:${owner}:${suffix}`; }
  private transient(error: unknown): boolean {
    return error instanceof TypeError || error instanceof AppError && error.code === 'NETWORK';
  }
  async findById(id: string, signal?: AbortSignal): Promise<Workout | null> {
    const owner = this.owner(), key = this.key(owner, `detail:${id}`);
    const cached = () => {
      const raw = this.cache.getItem(key);
      if (!raw) throw new AppError('This workout has not been saved on this device. Open it while online first.', 'NETWORK');
      return cachedWorkoutSchema.parse(JSON.parse(raw) as unknown);
    };
    if (this.isOffline()) return cached();
    let workout: Workout | null;
    try { workout = await this.remote.findById(id, signal); }
    catch (error) {
      if (signal?.aborted) throw error;
      if (this.transient(error) && this.cache.getItem(key)) return cached();
      if (error instanceof AppError && ['AUTHORIZATION', 'NOT_FOUND'].includes(error.code)) this.cache.removeItem(key);
      throw error;
    }
    if (workout) this.cache.setItem(key, JSON.stringify(workout));
    else this.cache.removeItem(key); // Deleted/revoked remote data is authoritative.
    return workout;
  }
  async listByOwner(ownerId: string, offset: number, signal?: AbortSignal): Promise<WorkoutPage> {
    const owner = this.owner();
    if (owner !== ownerId) throw new AppError('Saved workouts belong to another account.', 'AUTHORIZATION');
    const key = this.key(owner, `page:${offset}`);
    const cached = () => {
      const raw = this.cache.getItem(key);
      if (!raw) {
        // A detail may have been opened from Home without ever loading an owner
        // page. Keep that downloaded template discoverable after a cold start.
        const details = this.cache.valuesByPrefix(this.key(owner, 'detail:')).map((value) => cachedWorkoutSchema.parse(JSON.parse(value) as unknown))
          .filter((workout) => workout.ownerId === owner)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
        if (!details.length) throw new AppError('No workouts are cached for this page. Connect once to load them.', 'NETWORK');
        return { items: details.slice(offset, offset + 20), nextOffset: details.length > offset + 20 ? offset + 20 : null };
      }
      return cachedWorkoutPageSchema.parse(JSON.parse(raw) as unknown);
    };
    if (this.isOffline()) return cached();
    let page: WorkoutPage;
    try { page = await this.remote.listByOwner(owner, offset, signal); }
    catch (error) {
      if (!signal?.aborted && this.transient(error) && this.cache.getItem(key)) return cached();
      throw error;
    }
    this.cache.setItem(key, JSON.stringify(page));
    return page;
  }
  async save(input: WorkoutInput, id?: string, updatedAt?: string): Promise<string> {
    const owner = this.owner();
    if (this.isOffline()) throw new AppError('Connect to save template changes. Active workout logging works offline.', 'NETWORK');
    const savedId = await this.remote.save(input, id, updatedAt);
    // Cached page membership must not resurrect deleted/renamed templates.
    this.cache.removeByPrefix(this.key(owner, 'page:'));
    if (id) this.cache.removeItem(this.key(owner, `detail:${id}`));
    return savedId;
  }
  async delete(id: string, updatedAt: string): Promise<void> {
    const owner = this.owner();
    if (this.isOffline()) throw new AppError('Connect to delete a workout template.', 'NETWORK');
    await this.remote.delete(id, updatedAt);
    this.cache.removeItem(this.key(owner, `detail:${id}`));
    this.cache.removeByPrefix(this.key(owner, 'page:'));
  }
}
