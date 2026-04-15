/**
 * Shrinks listing images before POSTing through Next.js (Vercel serverless body limits ~4.5MB).
 * Listing uploads use multipart; large PNG/JPEG from cameras or auto-generated PNG thumbs can exceed that.
 */

const PASSTHROUGH_MAX_BYTES = 2 * 1024 * 1024; // stay under platform limits with multipart overhead
const TARGET_MAX_BYTES = 2 * 1024 * 1024;
const MAX_EDGE_PX = 2048;

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * Returns a JPEG or WebP file suitable for listing-media upload. Non-images are returned unchanged.
 */
export async function compressImageFileForListingUpload(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }
  if (file.size <= PASSTHROUGH_MAX_BYTES) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    let w = bitmap.width;
    let h = bitmap.height;
    if (w < 1 || h < 1) {
      return file;
    }

    const scale0 = Math.min(1, MAX_EDGE_PX / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale0));
    h = Math.max(1, Math.round(h * scale0));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);

    const baseName = (file.name.replace(/\.[^.]+$/, "") || "image").slice(0, 80);

    const tryMime = "image/jpeg";
    let quality = 0.88;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 14; attempt++) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), tryMime, quality);
      });
      if (!blob) {
        throw new Error("Could not compress image");
      }
      if (blob.size <= TARGET_MAX_BYTES) {
        break;
      }
      quality -= 0.07;
      if (quality < 0.45) {
        quality = 0.82;
        w = Math.max(1, Math.round(w * 0.82));
        h = Math.max(1, Math.round(h * 0.82));
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(bitmap, 0, 0, w, h);
      }
    }

    if (!blob || blob.size > TARGET_MAX_BYTES) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/webp", 0.75);
      });
    }

    if (!blob || blob.size > TARGET_MAX_BYTES) {
      throw new Error(
        "Image is still too large after compression. Try a smaller or lower-resolution file.",
      );
    }

    const outMime = blob.type || tryMime;
    const ext = extensionForMime(outMime);
    return new File([blob], `${baseName}.${ext}`, {
      type: outMime || "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
