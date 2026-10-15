import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock('../src/lib/ask', () => ({ askQuestion: mocks.ask }));
import { POST } from '../src/app/api/ask/route';
beforeEach(() => mocks.ask.mockReset());
const request = (body: unknown, headers = {}) => new Request('http://localhost/api/ask', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
describe('POST /api/ask', () => {
  it('uses only fixed public scope and disallows caller permissions', async () => {
    expect((await POST(request({ question: 'Can Harbour launch?' }, { 'x-knowbridge-tenant': 'private' }))).status).toBe(403);
    expect((await POST(request({ question: 'Can Harbour launch?', sourceIds: ['PRIVATE'] }))).status).toBe(400);
    expect(mocks.ask).not.toHaveBeenCalled();
  });
  it('bounds JSON and rejects malformed or invalid questions', async () => {
    expect((await POST(request({ question: 'x' }))).status).toBe(400);
    expect((await POST(request({ question: 'x'.repeat(2001) }))).status).toBe(400);
    expect((await POST(request({ question: 'x'.repeat(17000) }))).status).toBe(413);
    expect((await POST(new Request('http://localhost/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status).toBe(400);
    expect((await POST(new Request('http://localhost/api/ask', { method: 'POST', body: '{}' }))).status).toBe(415);
  });
  it('returns answer without caching and hides SDK errors', async () => {
    mocks.ask.mockResolvedValueOnce({ status: 'insufficient_evidence', answer: 'Insufficient evidence.' });
    const response = await POST(request({ question: 'Unknown evidence?' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.ask).toHaveBeenCalledWith('Unknown evidence?', 'demo-north-quay');
    mocks.ask.mockRejectedValueOnce(new Error('SECRET cloud diagnostic'));
    const failed = await POST(request({ question: 'Unknown evidence?' }));
    expect(failed.status).toBe(503);
    expect(JSON.stringify(await failed.json())).not.toContain('SECRET');
  });
});
