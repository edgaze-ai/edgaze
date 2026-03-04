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
    // Optimize production builds
    productionBrowserSourceMaps: false,
    // Optimize bundle size and loading performance
    experimental: {
      optimizePackageImports: ['lucide-react', 'framer-motion', '@supabase/supabase-js'],
      // Enable optimized CSS loading
      optimizeCss: true,
    },
    // Compiler optimizations
    compiler: {
      removeConsole: process.env.NODE_ENV === 'production' ? {
        exclude: ['error', 'warn'],
      } : false,
    },
    // Optimize module resolution
    modularizeImports: {
      'lucide-react': {
        transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      },
    },
    // Headers for performance and caching
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'X-DNS-Prefetch-Control',
              value: 'on'
            },
            {
              key: 'X-Frame-Options',
              value: 'SAMEORIGIN'
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff'
            },
          ],
        },
        {
          source: '/:path*\\.(jpg|jpeg|png|gif|ico|svg|webp|avif)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        {
          source: '/:path*\\.(js|css|woff|woff2|ttf|otf)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        {
          source: '/brand/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
      ];
    },
  };
})();

export default nextConfig;
