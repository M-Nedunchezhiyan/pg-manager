import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'PG Manager',
  description: 'Manage your paying-guest accommodations',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#22C55E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
