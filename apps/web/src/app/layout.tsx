import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';

import { RouteLoadingListener } from '@/components/route-loading-listener';
import { TopLoadingBar } from '@/components/top-loading-bar';
import { Toaster } from '@/components/ui/toaster';

import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const body = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PG Manager',
  description: 'Manage your paying-guest accommodations',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0369a1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-bg text-text antialiased">
        <TopLoadingBar />
        <RouteLoadingListener />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
