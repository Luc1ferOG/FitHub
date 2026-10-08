import type { DashboardRepository } from '../repositories/dashboard-repository';
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}
  load(timezone: string, signal?: AbortSignal) { return this.repository.load(timezone, signal); }
}
