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
    images: { remotePatterns },
  };
})();

export default nextConfig;
