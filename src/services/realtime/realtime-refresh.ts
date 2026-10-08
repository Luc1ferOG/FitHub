// Coalesce bursts. Changes during a request cause at most one trailing refresh.
export class RealtimeRefresh {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private dirty = false;
  private disposed = false;
  constructor(private readonly refresh: () => Promise<void>, private readonly delay = 500) {}
  schedule(): void {
    if (this.disposed) return;
    this.dirty = true;
    if (!this.running && !this.timer) this.timer = setTimeout(() => { void this.run(); }, this.delay);
  }
  private async run(): Promise<void> {
    this.timer = null;
    if (this.disposed) return;
    this.running = true;
    this.dirty = false;
    try { await this.refresh(); } catch { /* Query state presents failures. */ }
    finally { this.running = false; if (this.dirty && !this.disposed) this.schedule(); }
  }
  dispose(): void { this.disposed = true; if (this.timer) clearTimeout(this.timer); this.timer = null; }
}
