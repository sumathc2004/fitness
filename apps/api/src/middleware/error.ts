import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@gym/types';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
    if (err.status === 401 || err.status === 403) res.setHeader('Cache-Control', 'no-store');
    return void res.status(err.status).json(body);
  }
  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: { code: 'BAD_REQUEST', message: 'Invalid input', details: err.flatten().fieldErrors as Record<string, string[]> },
    };
    return void res.status(400).json(body);
  }
  // body-parser: malformed JSON / payload too large
  if (err?.type === 'entity.parse.failed') {
    return void res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } } satisfies ApiErrorBody);
  }
  if (err?.type === 'entity.too.large') {
    return void res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body is too large' } } satisfies ApiErrorBody);
  }
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side' } } satisfies ApiErrorBody);
};
