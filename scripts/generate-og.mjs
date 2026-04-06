/**
 * Generates public/og.png (1200×630) for Open Graph / social previews.
 * Favicons and PWA icons come from brand/edgaze-mark.png — run npm run favicon:generate.
 * Run: npm run og:generate
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

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

const png = await sharp(Buffer.from(ogSvg(1200, 630))).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(join(publicDir, "og.png"), png);
