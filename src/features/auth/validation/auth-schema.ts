import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));
const passwordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters')
  .max(128, 'Password must contain at most 128 characters');

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = loginSchema
  .extend({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Username must contain at least 3 characters')
      .max(30, 'Username must contain at most 30 characters')
      .regex(/^[a-z0-9_]+$/, 'Use only lowercase letters, numbers, and underscores'),
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name is required')
      .max(80, 'Display name must contain at most 80 characters'),
    confirmPassword: z.string(),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;
export type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;
