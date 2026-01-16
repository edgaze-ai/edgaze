export const dynamic = "force-static";

export function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://edgaze.ai";
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain" } }
  );
}
