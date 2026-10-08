import { z } from 'zod';

export const identifierSchema = z.string().uuid();
export const nonEmptyTextSchema = z.string().trim().min(1);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
