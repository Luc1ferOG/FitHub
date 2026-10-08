import { loginSchema, registerSchema } from '../auth-schema';

describe('loginSchema', () => {
  it('accepts valid credentials and normalizes the email', () => {
    const result = loginSchema.parse({ email: ' User@Example.COM ', password: 'password123' });
    expect(result.email).toBe('user@example.com');
  });

  it('rejects an invalid email and short password', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
    }
  });
});

describe('registerSchema', () => {
  const validRegistration = {
    username: 'fit_user',
    displayName: 'Fit User',
    email: 'fit@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  };

  it('accepts and normalizes a valid registration', () => {
    const result = registerSchema.parse({ ...validRegistration, username: ' FIT_USER ' });
    expect(result.username).toBe('fit_user');
  });

  it('rejects unsupported username characters', () => {
    const result = registerSchema.safeParse({ ...validRegistration, username: 'fit-user!' });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched password confirmation', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: 'different-password',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain('Passwords do not match');
    }
  });
});
