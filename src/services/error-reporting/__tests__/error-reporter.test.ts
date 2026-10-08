import { AppError } from '@/domain/errors/app-error';
import { errorReporter } from '../error-reporter';

it('does not log private messages, causes or contexts', () => {
  const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    errorReporter.capture(new AppError('Bearer private-token', 'NETWORK', { cause: { url: 'signed-private-url' }, context: { password: 'secret' } }));
    expect(JSON.stringify(logger.mock.calls)).not.toMatch(/private-token|signed-private-url|secret/);
    if (__DEV__) expect(logger).toHaveBeenCalledWith('FitHub error [NETWORK]');
  } finally { logger.mockRestore(); }
});
