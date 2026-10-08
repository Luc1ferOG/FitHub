export type AppErrorCode =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'CONFLICT'
  | 'NETWORK'
  | 'NOT_FOUND'
  | 'UNKNOWN'
  | 'VALIDATION';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly context: Readonly<Record<string, unknown>> | undefined;

  constructor(
    message: string,
    code: AppErrorCode = 'UNKNOWN',
    options?: { cause?: unknown; context?: Readonly<Record<string, unknown>> },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.context = options?.context;
  }
}
