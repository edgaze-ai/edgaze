import { NextRequest, NextResponse } from "next/server";
import { resolveTrustedUrl } from "@/lib/security/url-policy";

const DEFAULT_FILENAME = "workflow-image";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("bmp")) return "bmp";
  if (normalized.includes("avif")) return "avif";
  return "png";
}

function filenameFromUrl(url: URL, contentType: string): string {
  const lastPathSegment = url.pathname.split("/").filter(Boolean).pop() ?? "";
  const cleanedBase = safeFilenamePart(lastPathSegment.replace(/\.[a-z0-9]+$/i, ""));
  const base = cleanedBase || DEFAULT_FILENAME;
  return `${base}.${extensionFromContentType(contentType)}`;
}

export async function GET(req: NextRequest) {
  const srcParam = req.nextUrl.searchParams.get("src");
  const targetUrl = resolveTrustedUrl(srcParam, {
    allowLocalhost: false,
    allowPrivateIpv4: false,
  });

  if (!targetUrl) {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/*",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Image download failed." }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type")?.trim() || "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Remote file is not an image." }, { status: 415 });
    }

    const contentLength = Number(upstream.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large to download." }, { status: 413 });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large to download." }, { status: 413 });
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(arrayBuffer.byteLength),
        "Content-Disposition": `attachment; filename="${filenameFromUrl(targetUrl, contentType)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to download image." }, { status: 502 });
  }
}
