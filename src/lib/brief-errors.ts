import { NextResponse } from 'next/server';
import { ApiError } from './access';

// Controlled error mapping: client-facing messages come from ApiError or a fixed fallback, never raw errors.
export function briefFailure(error: unknown, fallback: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  }
  console.error('Decision brief operation failed.');
  return NextResponse.json({ error: fallback }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
