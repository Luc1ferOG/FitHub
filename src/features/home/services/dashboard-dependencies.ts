import { SupabaseDashboardRepository } from '@/data/repositories/supabase/supabase-dashboard-repository';
import { DashboardService } from './dashboard-service';

export const dashboardService = new DashboardService(new SupabaseDashboardRepository());
