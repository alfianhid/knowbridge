import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { middleware } from '../src/middleware';

afterEach(() => vi.unstubAllEnvs());

describe('style CSP', () => {
  it('permits only the Firebase Auth endpoints needed for judge sign-in', () => {
    vi.stubEnv('KNOWBRIDGE_JUDGE_SIGNIN_ENABLED', 'true');
    const policy = middleware(new NextRequest('https://demo.example/')).headers.get('Content-Security-Policy')!;
    expect(policy).toContain('https://identitytoolkit.googleapis.com https://securetoken.googleapis.com');
    expect(policy).not.toContain('https://*.googleapis.com');
  });
  it('allows the nonce-less Next development overlay styles', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = middleware(new NextRequest('http://localhost/'));
    expect(response.headers.get('Content-Security-Policy')).toContain("style-src 'self' 'unsafe-inline';");
  });

  it('keeps production styles nonce-protected and script policy strict', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = middleware(new NextRequest('http://localhost/'));
    const policy = response.headers.get('Content-Security-Policy')!;
    expect(policy).toMatch(/style-src 'self' 'nonce-[^']+';/);
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
  });

  it('adds narrowly scoped Picker origins only while Workspace is enabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'false');
    const disabled = middleware(new NextRequest('https://demo.example/'));
    expect(disabled.headers.get('Content-Security-Policy')).not.toContain('https://apis.google.com');
    expect(disabled.headers.get('Referrer-Policy')).toBe('no-referrer');
    vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'true');
    const enabled = middleware(new NextRequest('https://demo.example/'));
    const policy = enabled.headers.get('Content-Security-Policy')!;
    expect(enabled.headers.get('Referrer-Policy')).toBe('strict-origin');
    expect(policy).toContain('frame-src https://docs.google.com https://drive.google.com https://accounts.google.com');
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toContain('unsafe-inline');
  });
});
