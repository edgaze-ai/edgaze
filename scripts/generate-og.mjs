/**
 * Generates public/og.png (1200×630) and PWA-related PNGs under public/
 * referenced by layout metadata and site.webmanifest.
 * Run: npm run og:generate
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const brandDir = join(publicDir, "brand/icons");

const bg = "#0a0a0a";
const accent = "#22d3ee";

function ogSvg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="50%" y="46%" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="72" font-weight="700" fill="${accent}" text-anchor="middle" dominant-baseline="middle">Edgaze</text>
  <text x="50%" y="58%" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="28" fill="rgba(255,255,255,0.55)" text-anchor="middle" dominant-baseline="middle">AI prompts &amp; workflows</text>
  <text x="50%" y="88%" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="18" fill="rgba(255,255,255,0.35)" text-anchor="middle">edgaze.ai</text>
</svg>`;
}

function markSvg(size) {
  const r = Math.max(8, Math.round(size * 0.22));
  const fs = Math.round(size * 0.48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" rx="${r}" fill="${bg}"/>
  <text x="50%" y="54%" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${fs}" font-weight="700" fill="${accent}" text-anchor="middle" dominant-baseline="middle">E</text>
</svg>`;
}

async function writePng(svgString, outPath) {
  const buf = await sharp(Buffer.from(svgString)).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(outPath, buf);
}

mkdirSync(brandDir, { recursive: true });

await writePng(ogSvg(1200, 630), join(publicDir, "og.png"));
await writePng(markSvg(48), join(brandDir, "icon-48x48.png"));
await writePng(markSvg(96), join(brandDir, "icon-96x96.png"));
await writePng(markSvg(192), join(brandDir, "icon-192x192.png"));
await writePng(markSvg(180), join(publicDir, "apple-touch-icon.png"));
await writePng(markSvg(192), join(publicDir, "web-app-manifest-192x192.png"));
