import { z } from 'zod';

// PostgreSQL UUID accepts all 128-bit UUID values, including deterministic seed
// IDs that do not have an RFC version/variant. z.uuid() would reject those IDs.
export const databaseUuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
