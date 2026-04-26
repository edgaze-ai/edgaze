import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "src");
const libRoot = path.resolve(__dirname, "src/lib");

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
    // distDir is intentionally the default (`.next`) — overriding to a /tmp path made Next
    // rewrite tsconfig.json every boot to add absolute `/private/var/folders/.../types/**`
    // entries, which churned the file watcher into an endless Compiling/Rendering loop.
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
      formats: ["image/avif", "image/webp"],
      qualities: [75, 100],
      minimumCacheTTL: 60,
      dangerouslyAllowSVG: true,
      contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },
    compress: true,
    poweredByHeader: false,
    // StrictMode double-invokes effects in dev; with App Router + iCloud file watchers it amplifies
    // flaky “Compiling…” / router races. Production stays strict.
    reactStrictMode: process.env.NODE_ENV === "production",
    // pdfkit pulls optional native deps; keep it external for the server bundle.
    serverExternalPackages: ["pdfkit"],
    // Disable typed routes: it makes Next rewrite next-env.d.ts on every compile,
    // which (combined with distDir on iCloud Documents) causes an infinite
    // Compiling/Rendering loop in dev.
    typedRoutes: false,
    // Optimize production builds
    productionBrowserSourceMaps: false,
    // Optimize bundle size and loading performance
    experimental: {
      optimizePackageImports: ["lucide-react", "framer-motion", "@supabase/supabase-js"],
      // optimizeCss uses a PostCSS path that can break with Tailwind v4 + webpack (enhanced-resolve in workers).
      optimizeCss: false,
    },
    // Compiler optimizations
    compiler: {
      removeConsole:
        process.env.NODE_ENV === "production"
          ? {
              exclude: ["error", "warn"],
            }
          : false,
    },
    // Default Next 16 logging (incoming requests + browserToTerminal) is left ON so dev
    // surface area is visible. If terminal noise becomes a problem again, fix the cause
    // (e.g. component logging on every render), don't silence the channel.
    // Dev: use in-memory webpack cache only. Persistent `.next/dev/cache/webpack` pack renames and
    // Turbopack SST writes both fail on iCloud-/cloud-synced trees (Documents), leaving manifests missing.
    webpack: (config, { dev }) => {
      // Explicit aliases so client/server bundles resolve the same paths as tsconfig
      // (`@/…`, `src/…`, `@lib/…`) even when path mapping is not picked up everywhere.
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@": srcRoot,
        "@lib": libRoot,
        src: srcRoot,
      };
      if (dev) {
        config.cache = { type: "memory" };
        // Break compile/RSC loops: Next + dev-singleton rewrite tsconfig; distDir (often /tmp) churns
        // types/trace; iCloud quietly touches mtimes for sidecar/conflict files in ~/Documents.
        // Watching any of those retriggers webpack → endless "Compiling…" and GET / spam.
        const rootPosix = __dirname.replace(/\\/g, "/");
        const extras = [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.next 2/**",
          "**/.DS_Store",
          "**/*.icloud",
          "**/* 2.*",
          "**/* [0-9].*",
          `${rootPosix}/tsconfig.json`,
          `${rootPosix}/next-env.d.ts`,
        ];
        const dist = process.env.NEXT_DEV_DIST_DIR?.trim();
        if (dist) extras.push(`${dist.replace(/\\/g, "/")}/**`);
        const prevRaw = config.watchOptions?.ignored;
        const prevStrings = Array.isArray(prevRaw)
          ? prevRaw.filter((item) => typeof item === "string" && item.trim().length > 0)
          : typeof prevRaw === "string" && prevRaw.trim().length > 0
            ? [prevRaw]
            : [];
        const merged = [...new Set([...prevStrings, ...extras])];
        config.watchOptions = {
          ...config.watchOptions,
          ignored: merged,
          // Debounce: even if iCloud touches a watched file, batch any rebuilds for 300ms
          // so we don't pile up a recompile per touch.
          aggregateTimeout: 300,
          poll: false,
        };
      }
      return config;
    },
    // Optimize module resolution
    modularizeImports: {
      "lucide-react": {
        transform: "lucide-react/dist/esm/icons/{{kebabCase member}}",
      },
    },
    // Redirects for moved pages
    async redirects() {
      return [
        {
          source: "/edgaze/space",
          destination: "/marcos/space",
          permanent: true,
        },
        {
          source: "/legal/seller-terms",
          destination: "/docs/seller-terms",
          permanent: true,
        },
        {
          source: "/legal/refund-policy",
          destination: "/docs/refund-policy",
          permanent: true,
        },
      ];
    },
    // Headers for performance (skip aggressive caching in dev so you see changes immediately)
    async headers() {
      const isDev = process.env.NODE_ENV === "development";
      const headers = [
        {
          source: "/:path*",
          headers: [
            { key: "X-DNS-Prefetch-Control", value: "on" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            // Prevent this site from being embedded in iframes (clickjacking protection)
            { key: "X-Frame-Options", value: "DENY" },
            // Do not leak the full referrer URL to third-party origins
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            // Restrict access to sensitive browser features
            {
              key: "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
            },
            // Enforce HTTPS for 1 year (production only — skipped in dev via isDev guard below)
            ...(isDev
              ? []
              : [
                  {
                    key: "Strict-Transport-Security",
                    value: "max-age=31536000; includeSubDomains",
                  },
                ]),
          ],
        },
      ];
      if (!isDev) {
        headers.push(
          {
            source: "/:path*\\.(jpg|jpeg|png|gif|ico|svg|webp|avif)",
            headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
          },
          // Hashed build output only — avoids long immutable caching on arbitrary .js elsewhere.
          {
            source: "/_next/static/:path*",
            headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
          },
          {
            source: "/brand/:path*",
            headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
          },
        );
      }
      return headers;
    },
  };
})();

export default nextConfig;
