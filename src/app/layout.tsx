import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'KnowBridge — Evidence-backed decisions',
  description: 'Decision intelligence for Google Workspace SMEs. Synthetic demo only.'
};

const HEAD_SCRIPT = "document.documentElement.classList.add('js')";
const MOTION_SCRIPT = [
  "var root = document.documentElement;",
  "if ('IntersectionObserver' in window) {",
  "  var io = new IntersectionObserver(function (entries) {",
  "    entries.forEach(function (entry) {",
  "      if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }",
  "    });",
  "  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });",
  "  document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });",
  "} else { root.classList.remove('js'); }",
].join('\n');

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en">
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body>
        {children}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
      </body>
    </html>
  );
}
