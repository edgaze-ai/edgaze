import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_DIMENSION = 2_400;

function sanitizeOwnerHandle(ownerHandle: string | null): string {
  const raw = String(ownerHandle ?? "")
    .trim()
    .replace(/^@+/, "");
  const clean = raw.replace(/[^\w.-]+/g, "");
  return clean || "creator";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function loadBrandMarkDataUrl(): Promise<string> {
  const logoPath = path.join(process.cwd(), "public/brand/edgaze-mark.png");
  const buf = await readFile(logoPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function buildOverlaySvg(params: {
  width: number;
  height: number;
  ownerHandle: string;
  logoDataUrl: string;
}): string {
  const { width, height, ownerHandle, logoDataUrl } = params;
  const minEdge = Math.max(1, Math.min(width, height));
  const tileWidth = clamp(Math.round(minEdge * 0.34), 220, 460);
  const tileHeight = clamp(Math.round(tileWidth * 0.72), 170, 330);
  const logoSize = clamp(Math.round(tileWidth * 0.24), 44, 92);
  const brandFont = clamp(Math.round(tileWidth * 0.11), 18, 34);
  const ownerFont = clamp(Math.round(tileWidth * 0.08), 14, 26);
  const lineStrokeHeavy = clamp(Number((minEdge * 0.006).toFixed(2)), 2, 7);
  const lineStrokeLight = clamp(Number((minEdge * 0.0032).toFixed(2)), 1, 4);
  const centerBadgeWidth = clamp(Math.round(width * 0.48), 240, 820);
  const centerBadgeHeight = clamp(Math.round(height * 0.12), 96, 180);
  const centerLogoSize = clamp(Math.round(minEdge * 0.09), 64, 148);
  const safeOwner = escapeXml(`@${ownerHandle}`);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="edgaze-demo-wm" width="${tileWidth}" height="${tileHeight}" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
      <rect width="${tileWidth}" height="${tileHeight}" fill="transparent" />
      <line x1="-40" y1="0" x2="${tileWidth + 40}" y2="0" stroke="rgba(214,214,214,0.13)" stroke-width="${lineStrokeHeavy}" />
      <line x1="-40" y1="${Math.round(tileHeight * 0.22)}" x2="${tileWidth + 40}" y2="${Math.round(tileHeight * 0.22)}" stroke="rgba(196,196,196,0.08)" stroke-width="${lineStrokeLight}" />
      <line x1="-40" y1="${Math.round(tileHeight * 0.72)}" x2="${tileWidth + 40}" y2="${Math.round(tileHeight * 0.72)}" stroke="rgba(204,204,204,0.1)" stroke-width="${lineStrokeLight}" />
      <image href="${logoDataUrl}" x="${Math.round(tileWidth * 0.08)}" y="${Math.round(tileHeight * 0.12)}" width="${logoSize}" height="${logoSize}" opacity="0.16" preserveAspectRatio="xMidYMid meet" />
      <text x="${Math.round(tileWidth * 0.42)}" y="${Math.round(tileHeight * 0.34)}" font-family="Arial, Helvetica, sans-serif" font-size="${brandFont}" font-weight="700" letter-spacing="2.5" fill="rgba(222,222,222,0.16)">EDGAZE</text>
      <text x="${Math.round(tileWidth * 0.08)}" y="${Math.round(tileHeight * 0.63)}" font-family="Arial, Helvetica, sans-serif" font-size="${ownerFont}" font-weight="700" letter-spacing="1.3" fill="rgba(210,210,210,0.17)">${safeOwner}</text>
      <text x="${Math.round(tileWidth * 0.08)}" y="${Math.round(tileHeight * 0.84)}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.max(12, ownerFont - 2)}" font-weight="600" letter-spacing="1.8" fill="rgba(190,190,190,0.14)">DEMO PREVIEW</text>
    </pattern>
    <linearGradient id="edge-fade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.02)" />
      <stop offset="50%" stop-color="rgba(255,255,255,0.06)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.02)" />
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#edgaze-demo-wm)" />
  <rect width="${width}" height="${height}" fill="url(#edge-fade)" />

  <g opacity="0.22">
    <rect
      x="${Math.round((width - centerBadgeWidth) / 2)}"
      y="${Math.round((height - centerBadgeHeight) / 2)}"
      width="${centerBadgeWidth}"
      height="${centerBadgeHeight}"
      rx="${Math.round(centerBadgeHeight / 2)}"
      fill="rgba(20,20,20,0.18)"
      stroke="rgba(232,232,232,0.12)"
      stroke-width="${Math.max(1, lineStrokeLight)}"
    />
    <image
      href="${logoDataUrl}"
      x="${Math.round(width / 2 - centerBadgeWidth / 2 + centerBadgeHeight * 0.18)}"
      y="${Math.round(height / 2 - centerLogoSize / 2)}"
      width="${centerLogoSize}"
      height="${centerLogoSize}"
      opacity="0.2"
      preserveAspectRatio="xMidYMid meet"
    />
    <text
      x="${Math.round(width / 2 - centerBadgeWidth / 2 + centerBadgeHeight * 0.18 + centerLogoSize + 22)}"
      y="${Math.round(height / 2 - 6)}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${clamp(Math.round(centerBadgeHeight * 0.24), 18, 34)}"
      font-weight="800"
      letter-spacing="3"
      fill="rgba(235,235,235,0.18)"
    >EDGAZE DEMO</text>
    <text
      x="${Math.round(width / 2 - centerBadgeWidth / 2 + centerBadgeHeight * 0.18 + centerLogoSize + 22)}"
      y="${Math.round(height / 2 + 24)}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${clamp(Math.round(centerBadgeHeight * 0.17), 14, 24)}"
      font-weight="700"
      letter-spacing="1.6"
      fill="rgba(224,224,224,0.18)"
    >${safeOwner}</text>
  </g>
</svg>`;
}

async function fetchSourceBuffer(src: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (/^data:image\//i.test(src)) {
    const match = src.match(/^data:([^;,]+)(;base64)?,([\s\S]+)$/i);
    if (!match) {
      throw new Error("Invalid data image");
    }
    const mime = match[1] || "image/png";
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || "";
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { buffer, contentType: mime };
  }

  const response = await fetch(src, {
    redirect: "follow",
    cache: "force-cache",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "image/*,*/*;q=0.8",
      "User-Agent": "EdgazeDemoWatermark/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }

  const contentType = (response.headers.get("content-type") || "image/png").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new Error("Source is not an image");
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");
  const owner = sanitizeOwnerHandle(request.nextUrl.searchParams.get("owner"));

  if (!src) {
    return new Response("Missing src", { status: 400 });
  }

  try {
    const [{ buffer }, logoDataUrl] = await Promise.all([
      fetchSourceBuffer(src),
      loadBrandMarkDataUrl(),
    ]);
    const baseImage = sharp(buffer, { failOn: "none" }).rotate();
    const metadata = await baseImage.metadata();
    const width = metadata.width ?? 1200;
    const height = metadata.height ?? 1200;

    const resized = baseImage.resize({
      width:
        width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
          ? MAX_IMAGE_DIMENSION
          : undefined,
      height:
        width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
          ? MAX_IMAGE_DIMENSION
          : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
    const resizedMetadata = await resized.metadata();
    const finalWidth = resizedMetadata.width ?? width;
    const finalHeight = resizedMetadata.height ?? height;

    const overlaySvg = buildOverlaySvg({
      width: finalWidth,
      height: finalHeight,
      ownerHandle: owner,
      logoDataUrl,
    });

    const output = await resized
      .composite([{ input: Buffer.from(overlaySvg), blend: "over" }])
      .png()
      .toBuffer();

    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to watermark image";
    return new Response(message, { status: 422 });
  }
}
