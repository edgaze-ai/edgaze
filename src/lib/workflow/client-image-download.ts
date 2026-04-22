import { sanitizeNavigationHref } from "@/lib/security/url-policy";

/**
 * Client-only helpers for saving workflow image outputs on mobile (iOS/Android)
 * where <a download> on cross-origin URLs often fails or stalls.
 */

export function isWorkflowImageOutputUrl(s: string): boolean {
  if (typeof s !== "string" || !s.trim()) return false;
  const t = s.trim();

  if (/^data:image\//i.test(t)) return true;

  const safeHref = sanitizeNavigationHref(t);
  if (safeHref?.startsWith("http://") || safeHref?.startsWith("https://")) {
    try {
      const url = new URL(safeHref);
      const host = url.hostname.toLowerCase();
      const path = `${url.pathname}${url.search}`.toLowerCase();
      if (/\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(?:$|\?)/i.test(path)) return true;
      if (host === "oaidalleapiprodscus.blob.core.windows.net") return true;
      if (
        ["imgur.com", "unsplash.com", "pexels.com", "pixabay.com"].some(
          (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`),
        )
      ) {
        return true;
      }
      if (
        path.includes("/image/") ||
        path.includes("/images/") ||
        path.includes("/img/") ||
        path.includes("photo") ||
        path.includes("picture")
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

function extensionFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "png";
}

function filenameFromDisposition(
  disposition: string | null,
  fallbackStamp: number,
  mime: string,
): string {
  const fallback = `image-${fallbackStamp}.${extensionFromMime(mime)}`;
  if (!disposition) return fallback;

  const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/[/\\]+/g, "-");
    } catch {
      return utf8Match[1].replace(/[/\\]+/g, "-");
    }
  }

  const simpleMatch =
    disposition.match(/filename\s*=\s*"([^"]+)"/i) ?? disposition.match(/filename\s*=\s*([^;]+)/i);
  if (simpleMatch?.[1]) {
    return simpleMatch[1]
      .trim()
      .replace(/^"|"$/g, "")
      .replace(/[/\\]+/g, "-");
  }

  return fallback;
}

function triggerAnchorDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    triggerAnchorDownload(objectUrl, filename);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }
}

/**
 * Downloads image bytes when CORS allows; otherwise opens the URL so the user can
 * save from the browser (required on many iOS cross-origin cases).
 */
export async function downloadWorkflowImageFromUrl(src: string): Promise<void> {
  const stamp = Date.now();
  const rawSrc = typeof src === "string" ? src.trim() : "";
  if (!rawSrc) return;

  if (/^data:image\//i.test(rawSrc) || /^blob:/i.test(rawSrc)) {
    triggerAnchorDownload(rawSrc, `image-${stamp}.png`);
    return;
  }

  const safeSrc = sanitizeNavigationHref(rawSrc);
  if (!safeSrc) return;

  if (/^https?:\/\//i.test(safeSrc)) {
    const proxyUrl = `/api/workflow/download-image?src=${encodeURIComponent(safeSrc)}`;
    const controller = new AbortController();
    const tid = window.setTimeout(() => controller.abort(), 18_000);
    try {
      const res = await fetch(proxyUrl, {
        method: "GET",
        credentials: "same-origin",
        signal: controller.signal,
        cache: "no-store",
      });
      window.clearTimeout(tid);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      if (blob.size > 0) {
        const filename = filenameFromDisposition(
          res.headers.get("content-disposition"),
          stamp,
          blob.type || "",
        );
        await downloadBlob(blob, filename);
        return;
      }
      throw new Error("Empty image download");
    } catch {
      window.clearTimeout(tid);
      window.location.assign(proxyUrl);
      return;
    }
  }

  const controller = new AbortController();
  const tid = window.setTimeout(() => controller.abort(), 18_000);

  try {
    const res = await fetch(safeSrc, {
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
      cache: "force-cache",
    });
    window.clearTimeout(tid);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (blob.size <= 0) {
      throw new Error("Empty image download");
    }

    await downloadBlob(blob, `image-${stamp}.${extensionFromMime(blob.type || "")}`);
    return;
  } catch {
    window.clearTimeout(tid);
    const opened = window.open(safeSrc, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(safeSrc);
    }
  }
}
