import type { QueryClient } from '@tanstack/react-query';

// Bounded, development-only diagnostics. Never emit keys, IDs, data, URLs,
// credentials or errors. Durations include retries/paused time, not just HTTP.
export class QueryPerformanceMetrics {
  private starts = new Map<string, number>();
  private durations: number[] = [];
  private fetches = 0;
  private failures = 0;
  constructor(private readonly now: () => number = () => performance.now()) {}
  start(hash: string): void {
    if (!this.starts.has(hash) && this.starts.size >= 256) {
      const oldest = this.starts.keys().next().value;
      if (oldest !== undefined) this.starts.delete(oldest);
    }
    this.starts.set(hash, this.now()); this.fetches++;
  }
  finish(hash: string, failed: boolean): void {
    const start = this.starts.get(hash);
    this.starts.delete(hash);
    if (start === undefined) return;
    if (failed) this.failures++;
    this.durations.push(Math.max(0, this.now() - start));
    if (this.durations.length > 120) this.durations.shift();
  }
  discard(hash: string): void { this.starts.delete(hash); }
  clear(): void { this.starts.clear(); this.durations = []; }
  snapshot() {
    const sorted = [...this.durations].sort((a, b) => a - b);
    return { fetches: this.fetches, failures: this.failures, inFlight: this.starts.size, samples: sorted.length,
      p95QueryMs: sorted.length ? Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0) : 0 };
  }
}

export function startQueryPerformanceMonitoring(client: QueryClient): () => void {
  const metrics = new QueryPerformanceMetrics();
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type === 'removed') metrics.discard(event.query.queryHash);
    if (event.type !== 'updated') return;
    if (event.action.type === 'fetch') metrics.start(event.query.queryHash);
    if (event.action.type === 'success') metrics.finish(event.query.queryHash, false);
    if (event.action.type === 'error') metrics.finish(event.query.queryHash, true);
  });
  let previousFetches = 0;
  const timer = setInterval(() => {
    const snapshot = metrics.snapshot();
    if (snapshot.fetches !== previousFetches) {
      console.info('[FitHub performance]', { ...snapshot, cachedQueries: client.getQueryCache().getAll().length });
      previousFetches = snapshot.fetches;
    }
  }, 60_000);
  return () => { unsubscribe(); clearInterval(timer); metrics.clear(); };
}
