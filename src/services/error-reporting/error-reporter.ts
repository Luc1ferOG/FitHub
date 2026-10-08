import type { AppError } from '@/domain/errors/app-error';

export interface ErrorReporter {
  capture(error: AppError): void;
}

class DevelopmentErrorReporter implements ErrorReporter {
  capture(error: AppError): void {
    if (__DEV__) {
      // Transport causes and messages may contain credentials, health data or signed URLs.
      console.error(`FitHub error [${error.code}]`);
    }
  }
}

export const errorReporter: ErrorReporter = new DevelopmentErrorReporter();
