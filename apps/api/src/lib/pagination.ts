import { z } from 'zod';

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const skipTake = (p: { page: number; pageSize: number }) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize });

/** Parses `req.query` with a zod schema (Express 5 makes req.query read-only, so we return the parsed value). */
export function parseQuery<S extends z.ZodTypeAny>(schema: S, query: unknown): z.infer<S> {
  return schema.parse(query);
}

export const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);
