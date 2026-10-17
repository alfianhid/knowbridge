import { NextResponse } from 'next/server';
import { ApiError } from './access';

// Controlled error mapping: client-facing messages come from ApiError or a fixed fallback, never raw errors.
export function briefFailure(error: unknown, fallback: string): NextResponse {
  if (error instanceof ApiError) {
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    if (typeof error.retryAfterSeconds === 'number') headers['Retry-After'] = String(error.retryAfterSeconds);
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
  console.error('Decision brief operation failed.');
  return NextResponse.json({ error: fallback }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
