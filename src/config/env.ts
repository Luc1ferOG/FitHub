import { z } from 'zod';

const environmentSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsedEnvironment = environmentSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsedEnvironment.success) {
  const missingKeys = parsedEnvironment.error.issues
    .map((issue) => issue.path.join('.'))
    .join(', ');

  throw new Error(`Invalid environment configuration: ${missingKeys}`);
}

export const env = Object.freeze(parsedEnvironment.data);
