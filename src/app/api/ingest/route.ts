import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ingestSyntheticSources } from '../../../lib/sources';
import { ApiError, requireIngestionAdmin } from '../../../lib/access';
import { readBoundedJson } from '../../../lib/api-limits';
import { getSourceStore } from '../../../lib/source-store';

const requestSchema = z.object({
  mode: z.literal('synthetic'),
  sourceIds: z.array(z.string().max(64).regex(/^[A-Z0-9-]+$/)).min(1).max(18).optional(),
}).strict().superRefine((value, context) => {
  if (value.sourceIds && new Set(value.sourceIds).size !== value.sourceIds.length) {
    context.addIssue({ code: 'custom', message: 'Source IDs must be unique.', path: ['sourceIds'] });
  }
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireIngestionAdmin(request);
    const body = requestSchema.parse(await readBoundedJson(request));
    const store = getSourceStore();
    if (!await store.consumeIngestionQuota(actor)) throw new ApiError(429, 'Ingestion limit reached. Retry shortly.');
    const result = await ingestSyntheticSources({ store, sourceIds: body.sourceIds, actor });
    console.info('Synthetic ingestion completed.', { jobId: result.jobId, processed: result.processed, failed: result.failed });
    return NextResponse.json(result, { status: result.failed ? 207 : 200 });
  } catch (error: unknown) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid ingestion request.' }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith('Unknown synthetic source ID:')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Synthetic ingestion failed.');
    return NextResponse.json({ error: 'Synthetic ingestion failed.' }, { status: 500 });
  }
}
