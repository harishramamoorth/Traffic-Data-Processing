import { z } from 'zod';

export const piiActionEnum = z.enum([
  'PSEUDONYMIZE_HMAC',
  'REDACT',
  'DROP_COLUMN',
  'GENERALIZE_SPATIAL',
  'TIME_BUCKET',
  'KEEP'
]);

export const jobConfigSchema = z.object({
  standardizeColumnNames: z.boolean().optional().default(true),
  standardizeDates: z.boolean().optional().default(true),
  trimWhitespace: z.boolean().optional().default(true),
  removeDuplicates: z.boolean().optional().default(true),
  outlierStrategy: z.enum(['flag_only', 'set_null', 'cap']).optional().default('flag_only'),
  gpsPrecision: z.number().int().min(0).max(4).optional().default(2),
  timeBucketMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).optional().default(15),
  suppressLowK: z.boolean().optional().default(false),
  riskReductionMode: z.enum(['none', 'suppress', 'aggregate']).optional().default('none'),
  kThreshold: z.number().int().min(2).max(10).optional().default(3),
  piiActions: z.record(z.string(), piiActionEnum).optional().default({}),
  missingValueStrategy: z.record(z.string(), z.string()).optional().default({})
});

export function validateJobConfig(config) {
  const normalized = { ...config };
  if (normalized.risk_reduction_mode && !normalized.riskReductionMode) {
    normalized.riskReductionMode = normalized.risk_reduction_mode;
  }
  if (normalized.k_threshold && !normalized.kThreshold) {
    normalized.kThreshold = Number(normalized.k_threshold);
  }
  if (normalized.k && !normalized.kThreshold) {
    normalized.kThreshold = Number(normalized.k);
  }
  return jobConfigSchema.safeParse(normalized);
}
