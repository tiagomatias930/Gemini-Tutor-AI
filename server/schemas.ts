import type {NextFunction, Request, Response} from 'express';
import {z, type ZodType} from 'zod';

const sessionId = z.string().regex(/^[a-f0-9]{32}$/);
const boundedText = z.string().trim().min(1).max(20_000);
const telemetryFields = {
  locationConsent: z.boolean().optional(),
  cacheEnabled: z.boolean().optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(120).optional(),
};

export const adminLoginSchema = z.object({key: z.string().min(1).max(512)}).strict();

export const chatSchema = z
  .object({
    message: z.string().max(20_000).optional(),
    image: z.string().max(8_000_000).optional(),
    sessionId: sessionId.optional(),
    generateImage: z.boolean().optional(),
    search: z.boolean().optional(),
    fileData: z
      .object({
        name: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(100),
        data: z.string().max(8_000_000),
        isText: z.boolean(),
      })
      .strict()
      .optional(),
    studentContext: z
      .object({
        language: z.string().max(30).optional(),
        level: z.enum(['unknown', 'beginner', 'intermediate', 'advanced']).optional(),
        subjects: z.array(z.string().max(80)).max(20).optional(),
        learningStyle: z.string().max(80).optional(),
        strengths: z.array(z.string().max(120)).max(20).optional(),
        struggles: z.array(z.string().max(120)).max(20).optional(),
        topicsCovered: z.array(z.string().max(120)).max(30).optional(),
        isDeafMode: z.boolean().optional(),
        isVisionAssist: z.boolean().optional(),
        triageComplete: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ...telemetryFields,
  })
  .strict()
  .refine(value => Boolean(value.message?.trim() || value.image || value.fileData), {
    message: 'message, image, or fileData is required',
  });

export const imageSchema = z
  .object({
    concept: boundedText,
    context: z.string().max(10_000).optional(),
    sessionId: sessionId.optional(),
    ...telemetryFields,
  })
  .strict();

export const voiceSchema = z
  .object({
    sessionId: sessionId.optional(),
    messages: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            text: boundedText,
          })
          .strict()
      )
      .min(1)
      .max(100),
    ...telemetryFields,
  })
  .strict();

export const heartbeatSchema = z
  .object({
    sessionId: sessionId.optional(),
    durationSeconds: z.number().int().min(0).max(31_536_000).optional(),
    ...telemetryFields,
  })
  .strict();

export const purgeSchema = z
  .object({retentionDays: z.number().int().min(1).max(3650).default(90)})
  .strict();

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
