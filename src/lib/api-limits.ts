import { ApiError } from './access';

const MAX_BODY_BYTES = 16 * 1024;
const reads = new Map<string, { window: number; count: number }>();

export async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'JSON content type required.');
  }
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    throw new ApiError(413, 'Ingestion request too large.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Invalid ingestion request.');
  const buffers: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, 'Ingestion request too large.');
      }
      buffers.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(buffers).toString('utf8'));
}

export function limitPublicReads(now = Date.now()): void {
  // Per-instance global cap cannot be bypassed using spoofed proxy/IP headers.
  const window = Math.floor(now / 60_000);
  const counter = reads.get('public');
  const count = counter?.window === window ? counter.count : 0;
  if (count >= 300) throw new ApiError(429, 'Read limit reached. Retry shortly.');
  reads.set('public', { window, count: count + 1 });
}
