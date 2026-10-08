import type { HomeDashboard } from '../types/dashboard';
export interface DashboardRepository {
  load(timezone: string, signal?: AbortSignal): Promise<HomeDashboard>;
}
