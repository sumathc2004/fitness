import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors';

type Source = 'body' | 'params';

/** Validates and replaces req.body / req.params with the parsed (trimmed, coerced, typed) value. */
export const validate =
  (schema: ZodTypeAny, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors as Record<string, string[]>;
      throw badRequest('Please check the highlighted fields', details);
    }
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
