import { logoutWithCleanup } from '../logout-with-cleanup';

it('attempts SDK logout even when push-token unregistration fails', async () => {
  const logout = jest.fn().mockResolvedValue(undefined);
  await logoutWithCleanup({ logout }, { disable: jest.fn().mockRejectedValue(new Error('offline')) });
  expect(logout).toHaveBeenCalledTimes(1);
});
it('does not swallow an unsuccessful SDK logout', async () => {
  await expect(logoutWithCleanup({ logout: async () => { throw new Error('Auth unavailable'); } }, { disable: async () => {} })).rejects.toThrow('Auth unavailable');
});
