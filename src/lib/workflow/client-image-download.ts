import { sanitizeNavigationHref } from "@/lib/security/url-policy";

/**
 * Client-only helpers for saving workflow image outputs on mobile (iOS/Android)
 * where <a download> on cross-origin URLs often fails or stalls.
 */

export function isWorkflowImageOutputUrl(s: string): boolean {
  if (typeof s !== "string" || !s.trim()) return false;
  const t = s.trim();

  if (/^data:image\//i.test(t)) return true;

  if (/^https?:\/\//i.test(t)) {
    if (/\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?|$)/i.test(t)) return true;
    if (/oaidalleapiprodscus\.blob\.core\.windows\.net/i.test(t)) return true;
    if (/imgur\.com|unsplash\.com|pexels\.com|pixabay\.com/i.test(t)) return true;
    if (/\/images?\/|\/img\/|image|photo|picture/i.test(t)) return true;
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

/**
 * Downloads image bytes when CORS allows; otherwise opens the URL so the user can
 * save from the browser (required on many iOS cross-origin cases).
 */
export async function downloadWorkflowImageFromUrl(src: string): Promise<void> {
  const stamp = Date.now();
  const rawSrc = typeof src === "string" ? src.trim() : "";
  if (!rawSrc) return;

  if (/^data:image\//i.test(rawSrc) || /^blob:/i.test(rawSrc)) {
    const a = document.createElement("a");
    a.href = rawSrc;
    a.download = `image-${stamp}.png`;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const safeSrc = sanitizeNavigationHref(rawSrc);
  if (!safeSrc) return;

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

    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `image-${stamp}.${extensionFromMime(blob.type || "")}`;
        a.rel = "noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
        return;
      }
    }
  } catch {
    window.clearTimeout(tid);
  }

  const opened = window.open(safeSrc, "_blank", "noopener,noreferrer");
  if (!opened) {
    const a = document.createElement("a");
    a.href = safeSrc;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
