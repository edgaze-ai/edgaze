/** @type {import('next').NextConfig} */
const nextConfig = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let supabaseHostname = null;

  try {
    supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null;
  } catch {
    supabaseHostname = null;
  }

  const remotePatterns = [
    {
      protocol: "https",
      hostname: "lh3.googleusercontent.com",
      pathname: "/**",
    },
  ];

  // allow your actual supabase project host for storage public URLs
  if (supabaseHostname) {
    remotePatterns.push({
      protocol: "https",
      hostname: supabaseHostname,
      pathname: "/storage/v1/object/public/**",
    });
  }

  return {
    // Pure ESM remark/mdast packages need transpilation for the webpack client bundle.
    transpilePackages: [
      "react-markdown",
      "remark-gfm",
      "remark-rehype",
      "mdast-util-to-markdown",
      "mdast-util-to-hast",
      "mdast-util-from-markdown",
      "mdast-util-gfm",
      "mdast-util-gfm-table",
      "mdast-util-gfm-task-list-item",
      "mdast-util-gfm-footnote",
      "mdast-util-gfm-strikethrough",
    ],
    images: { 
      remotePatterns,
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 60,
      dangerouslyAllowSVG: true,
      contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },
    compress: true,
    poweredByHeader: false,
    reactStrictMode: true,
    // pdfkit pulls optional native deps; keep it external for the server bundle.
    serverExternalPackages: ['pdfkit'],
    // Optimize production builds
    productionBrowserSourceMaps: false,
    // Optimize bundle size and loading performance
    experimental: {
      optimizePackageImports: ['lucide-react', 'framer-motion', '@supabase/supabase-js'],
      // optimizeCss uses a PostCSS path that can break with Tailwind v4 + webpack (enhanced-resolve in workers).
      optimizeCss: false,
    },
    // Compiler optimizations
    compiler: {
      removeConsole: process.env.NODE_ENV === 'production' ? {
        exclude: ['error', 'warn'],
      } : false,
    },
    // Dev: disable webpack persistent filesystem cache so `.next/dev/cache/webpack/**` pack renames
    // cannot race (ENOENT 0.pack.gz_ → 0.pack.gz) when the tree is synced, deleted, or contended.
    webpack: (config, { dev }) => {
      if (dev) {
        config.cache = false;
      }
      return config;
    },
    // Optimize module resolution
    modularizeImports: {
      'lucide-react': {
        transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      },
    },
    // Redirects for moved pages
    async redirects() {
      return [
        {
          source: '/legal/seller-terms',
          destination: '/docs/seller-terms',
          permanent: true,
        },
        {
          source: '/legal/refund-policy',
          destination: '/docs/refund-policy',
          permanent: true,
        },
      ];
    },
    // Headers for performance (skip aggressive caching in dev so you see changes immediately)
    async headers() {
      const isDev = process.env.NODE_ENV === 'development';
      const headers = [
        {
          source: '/:path*',
          headers: [
            { key: 'X-DNS-Prefetch-Control', value: 'on' },
            { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
          ],
        },
      ];
      if (!isDev) {
        headers.push(
          { source: '/:path*\\.(jpg|jpeg|png|gif|ico|svg|webp|avif)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
          // Hashed build output only — avoids long immutable caching on arbitrary .js elsewhere.
          {
            source: '/_next/static/:path*',
            headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
          },
          { source: '/brand/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }
        );
      }
      return headers;
    },
  };
})();

export default nextConfig;
