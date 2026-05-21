/** @type {import('next').NextConfig} */
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').hostname;
  } catch {
    return 'placeholder.supabase.co';
  }
})();

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Vercel handles the build output natively; no `output: 'standalone'` needed.
  experimental: { typedRoutes: true },

  // ESLint plugins live at the monorepo root and aren't all hoisted into apps/web;
  // run `pnpm lint` separately when you want lint feedback.
  eslint: { ignoreDuringBuilds: true },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: supabaseHost },
    ],
  },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseWss = supabaseUrl.replace(/^https:/, 'wss:');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${supabaseUrl}`,
              `connect-src 'self' ${supabaseUrl} ${supabaseWss}`,
              "font-src 'self' data:",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              isProd ? 'upgrade-insecure-requests' : '',
            ]
              .filter(Boolean)
              .join('; '),
          },
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
