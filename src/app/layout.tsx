import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'KnowBridge — Evidence-backed decisions',
  description: 'Decision intelligence for Google Workspace SMEs. Synthetic demo only.'
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
