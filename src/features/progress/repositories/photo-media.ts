import type { LocalPhoto, PreparedPhoto } from '../types/progress-photo';
export interface PhotoMedia {
  pick(): Promise<LocalPhoto | null>;
  prepare(photo: LocalPhoto): Promise<PreparedPhoto>;
  cleanup(photo: LocalPhoto): Promise<void>;
}
