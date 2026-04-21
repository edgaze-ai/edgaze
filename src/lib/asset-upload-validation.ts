/**
 * Asset upload validation: max size, MIME allowlist, and magic-byte checks
 * to prevent malicious file uploads and abuse.
 */

export const MAX_ASSET_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Allowed MIME types for asset uploads. SVG/ICO excluded: SVG can contain scripts (XSS), ICO rarely needed. */
export const ALLOWED_ASSET_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

/** Magic bytes for image types (first few bytes). */
const MAGIC: { mime: string; bytes: number[] }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF - need to check bytes 8-11 for WEBP
];

function matchesMagic(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

/**
 * Validate file by magic bytes for image types.
 * Returns the MIME type that matches, or null if no match (or not an image we validate).
 */
export function getMimeFromMagic(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  for (const { mime, bytes: magic } of MAGIC) {
    if (!matchesMagic(bytes, magic)) continue;
    if (mime === "image/webp") {
      // RIFF....WEBP at offset 8
      if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
        return mime;
      continue;
    }
    return mime;
  }
  return null;
}

export function canonicalizeAssetMime(mime: string | null | undefined): string {
  const value = String(mime || "")
    .toLowerCase()
    .trim();
  if (value === "image/jpg") return "image/jpeg";
  return value;
}

export function assetMimeLabel(mime: string | null | undefined): string {
  const value = canonicalizeAssetMime(mime);
  if (value === "image/png") return "PNG";
  if (value === "image/jpeg") return "JPEG";
  if (value === "image/gif") return "GIF";
  if (value === "image/webp") return "WebP";
  if (!value) return "unknown";
  return value;
}

export function explainAssetMimeMismatch(
  declaredMime: string | null | undefined,
  detectedMime: string | null | undefined,
): string {
  const declared = assetMimeLabel(declaredMime);
  const detected = assetMimeLabel(detectedMime);
  return `File content does not match declared type. The file says ${declared}, but the actual contents look like ${detected}. This usually means the image was renamed without converting it, exported incorrectly, or uploaded with the wrong extension.`;
}

export function resolveAssetMime(file: File, bytes: Uint8Array): string | null {
  const declared = canonicalizeAssetMime(file.type);
  const detected = canonicalizeAssetMime(getMimeFromMagic(bytes));
  if (detected) return detected;
  if (declared && ALLOWED_ASSET_MIME_TYPES.has(declared)) return declared;
  return null;
}

/**
 * Validate asset file: size, client MIME in allowlist, and for images
 * optionally verify magic bytes match. Returns null if valid, or an error message.
 */
export function validateAssetFile(
  file: File,
  bytes: Uint8Array,
  options: { requireMagicMatchForImages?: boolean } = {},
): string | null {
  if (file.size > MAX_ASSET_FILE_BYTES) {
    return `File too large. Maximum size is ${MAX_ASSET_FILE_BYTES / 1024 / 1024} MB`;
  }
  const clientMime = canonicalizeAssetMime(file.type);
  const magicMime = canonicalizeAssetMime(getMimeFromMagic(bytes));
  if (!clientMime && !magicMime) return "Unsupported image file. Use PNG, JPEG, GIF, or WebP.";
  const effectiveMime = clientMime || magicMime;
  if (!effectiveMime) return "Unsupported image file. Use PNG, JPEG, GIF, or WebP.";
  if (!ALLOWED_ASSET_MIME_TYPES.has(effectiveMime)) {
    return "File type not allowed. Allowed: PNG, JPEG, GIF, WebP";
  }
  const { requireMagicMatchForImages = true } = options;
  if (requireMagicMatchForImages && effectiveMime.startsWith("image/")) {
    if (clientMime && magicMime && magicMime !== clientMime) {
      return explainAssetMimeMismatch(clientMime, magicMime);
    }
    if (
      ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(effectiveMime) &&
      !magicMime
    ) {
      return `File content does not match the selected image format. We could not verify valid ${assetMimeLabel(effectiveMime)} image data in the uploaded file.`;
    }
  }
  return null;
}
