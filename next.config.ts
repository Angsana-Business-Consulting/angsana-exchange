import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,

  // ---------------------------------------------------------------------------
  // Cache-Control headers — critical for Firebase Hosting CDN.
  //
  // Firebase Hosting sits in front of Cloud Run as a CDN reverse-proxy.
  // It respects Cache-Control headers from Cloud Run.  Next.js static pages
  // default to  s-maxage=31536000  which causes the CDN to cache HTML for a
  // year.  After a new deployment the chunk hashes change but the CDN serves
  // stale HTML referencing old hashes → ChunkLoadError / 404.
  //
  // Fix: mark all HTML responses as non-cacheable so the CDN always proxies
  // to Cloud Run.  _next/static/ assets are content-hashed and safe to cache
  // immutably (Next.js already does this by default).
  // ---------------------------------------------------------------------------
  headers: async () => [
    {
      // All pages / API routes — prevent CDN caching of HTML
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=0, must-revalidate',
        },
      ],
    },
  ],
};

export default nextConfig;
