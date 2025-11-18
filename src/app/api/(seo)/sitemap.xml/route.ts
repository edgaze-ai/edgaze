export const dynamic = "force-static";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const urls = ["/"]; // We’ll add dynamic tool routes later
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls
      .map(
        (u) => `<url>
      <loc>${base}${u}</loc>
      <changefreq>daily</changefreq>
      <priority>0.7</priority>
    </url>`,
      )
      .join("\n")}
  </urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
