/**
 * Build favicon + small PNG icons from public/brand/edgaze-mark.png.
 * Uses letterboxing (fit: contain) on a transparent square — full mark visible, alpha preserved.
 * Run: npm run favicon:generate
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const brandDir = join(publicDir, "brand");
const brandIconsDir = join(brandDir, "icons");
const markPath = join(brandDir, "edgaze-mark.png");
const outIco = join(publicDir, "favicon.ico");

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

/** Read once; truecolor RGBA PNGs only (no palette) for correct ICO + browser rendering. */
const markBuffer = readFileSync(markPath);

async function markToSquarePng(size) {
  return sharp(markBuffer)
    .ensureAlpha()
    .resize(size, size, {
      fit: "contain",
      position: "centre",
      background: transparent,
    })
    .png({
      compressionLevel: 9,
      palette: false,
      adaptiveFiltering: true,
    })
    .toBuffer();
}

async function main() {
  mkdirSync(brandIconsDir, { recursive: true });

  const png16 = await markToSquarePng(16);
  const png32 = await markToSquarePng(32);
  const png48 = await markToSquarePng(48);

  // Prefer PNG favicons in metadata first — avoids brittle legacy ICO decoding in some browsers.
  writeFileSync(join(publicDir, "favicon-16x16.png"), png16);
  writeFileSync(join(publicDir, "favicon-32x32.png"), png32);

  // ICO: smallest → largest is a common convention for embedded PNG frames.
  writeFileSync(outIco, await toIco([png16, png32, png48]));

  writeFileSync(join(brandIconsDir, "icon-48x48.png"), png48);
  writeFileSync(join(brandIconsDir, "icon-96x96.png"), await markToSquarePng(96));
  writeFileSync(join(brandIconsDir, "icon-192x192.png"), await markToSquarePng(192));
  writeFileSync(join(publicDir, "apple-touch-icon.png"), await markToSquarePng(180));
  writeFileSync(join(publicDir, "web-app-manifest-192x192.png"), await markToSquarePng(192));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
