import { z } from 'zod';
import { AUTH, ROLE_NAMES } from '@gym/config';

// ───────────────────────── Primitives
export const roleSchema = z.enum(ROLE_NAMES);

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(190);

export const passwordSchema = z
  .string()
  .min(AUTH.passwordMinLength, `Use at least ${AUTH.passwordMinLength} characters`)
  .max(128, 'Password is too long')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number');

