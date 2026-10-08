import { RealtimeRefresh } from './realtime-refresh';

// A lifecycle, not a global singleton. Hidden/offline/background screens own no
// channel or polling timer; late events cannot schedule work after suspension.
export class ForegroundRefresh {
  private coordinator: RealtimeRefresh | null = null;
  private cleanup: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private readonly subscribe: (changed: () => void) => () => void,
    private readonly refresh: () => Promise<void>, private readonly interval = 60_000) {}

  setActive(active: boolean): void {
    if (!active) { this.dispose(); return; }
    if (this.coordinator) return;
    const coordinator = new RealtimeRefresh(this.refresh);
    this.coordinator = coordinator;
    this.cleanup = this.subscribe(() => coordinator.schedule());
    this.timer = setInterval(() => coordinator.schedule(), this.interval);
    coordinator.schedule(); // Recover missed events when returning to the screen.
  }
  schedule(): void { this.coordinator?.schedule(); }
  dispose(): void {
    this.coordinator?.dispose(); this.coordinator = null;
    this.cleanup?.(); this.cleanup = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
