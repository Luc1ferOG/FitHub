import { SupabaseMeasurementRepository } from '@/data/repositories/supabase/supabase-measurement-repository';
import { MeasurementService } from './measurement-service';
export const measurementService = new MeasurementService(new SupabaseMeasurementRepository());
