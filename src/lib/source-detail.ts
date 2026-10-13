import { z } from 'zod';

export const SourceDetailSchema = z.object({
  id: z.string().regex(/^[A-Z0-9-]{1,64}$/), title: z.string().min(1),
  kind: z.enum(['google_doc', 'google_sheet']), project: z.string(),
  owner: z.string(), recordedAt: z.iso.date(), effectiveAt: z.iso.date().nullable(),
  chunkCount: z.number().int().positive(), content: z.string().min(1),
  sourceUrl: z.string().regex(/^\/api\/sources\/[A-Z0-9-]{1,64}$/), synthetic: z.literal(true),
});
export type SourceDetail = z.infer<typeof SourceDetailSchema>;
