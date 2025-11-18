export const dynamic = "force-static";

export function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${base}/api/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain" } }
  );
}
