import type { z } from 'zod';
import type { dashboardResponse } from '../validation/dashboard-response';
export type HomeDashboard = z.infer<typeof dashboardResponse>;
