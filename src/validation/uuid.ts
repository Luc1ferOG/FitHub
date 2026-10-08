import { AppError } from '@/domain/errors/app-error';
export function isUuid(value: string): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function requireUuid(value: string): void {
  if (!isUuid(value)) throw new AppError('Invalid identifier.','VALIDATION');
}
