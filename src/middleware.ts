import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const development = process.env.NODE_ENV !== 'production';
  const workspace = process.env.KNOWBRIDGE_WORKSPACE_ENABLED === 'true';
  const policy = [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ''}${workspace ? ' https://apis.google.com https://www.gstatic.com' : ''}`,
    // Next.js development tools inject styles without a nonce into their dev overlay.
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`, "img-src 'self' data:", "font-src 'self'",
    `connect-src 'self'${development ? ' ws: wss:' : ''}${workspace ? ' https://www.googleapis.com https://apis.google.com' : ''}`,
    ...(workspace ? ['frame-src https://docs.google.com https://drive.google.com https://accounts.google.com'] : []),
    "form-action 'self'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  // Picker's restricted developer key requires the app origin as referrer.
  // Never send a path/query; API callbacks retain the global no-referrer policy.
  response.headers.set('Referrer-Policy', workspace ? 'strict-origin' : 'no-referrer');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
