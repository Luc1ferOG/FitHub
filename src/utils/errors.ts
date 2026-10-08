import { AppError } from '@/domain/errors/app-error';

export function toAppError(error: unknown, fallbackMessage = 'Something went wrong.'): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message || fallbackMessage, 'UNKNOWN', { cause: error });
  }

  return new AppError(fallbackMessage, 'UNKNOWN', { cause: error });
}

export function getErrorMessage(error: unknown): string {
  return toAppError(error).message;
}

/** An authoritative missing/forbidden record must not keep stale detail UI alive. */
export function isUnavailableRecord(error: unknown): boolean {
  return error instanceof AppError && (error.code === 'NOT_FOUND' || error.code === 'AUTHORIZATION');
}
