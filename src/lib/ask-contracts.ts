import { z } from 'zod';

export const ModelAnswerSchema = z.object({
  status: z.enum(['supported', 'insufficient_evidence']),
  claims: z.array(z.object({
    claim: z.string().min(3).max(2000),
    evidence: z.array(z.object({
      sourceId: z.string().regex(/^[A-Z0-9-]{1,64}$/),
      excerpt: z.string().min(8).max(8000),
    })).min(1).max(8),
  })).max(12),
  unknowns: z.array(z.string().min(1).max(2000)).max(12),
}).superRefine((answer, context) => {
  if (answer.status === 'supported' && !answer.claims.length) {
    context.addIssue({ code: 'custom', message: 'Supported answers require evidence.' });
  }
  if (answer.status === 'insufficient_evidence' && (!answer.unknowns.length || answer.claims.length)) {
    context.addIssue({ code: 'custom', message: 'Abstention requires missing evidence and no claims.' });
  }
});

export const AskRequestSchema = z.object({ question: z.string().trim().min(4).max(2000) }).strict();
