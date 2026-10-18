import { z } from 'zod';

export const jobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional().default(''),
  status: z.enum(['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional().default('ALL')
});

export const recordsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  filter: z.string().optional()
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'Job ID is required')
});

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        issues: result.error.errors
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL parameters',
        issues: result.error.errors
      });
    }
    req.validatedParams = result.data;
    next();
  };
}
