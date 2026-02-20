/**
 * Asset upload validation: max size, MIME allowlist, and magic-byte checks
 * to prevent malicious file uploads and abuse.
 */

export const MAX_ASSET_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Allowed MIME types for asset uploads. SVG/ICO excluded: SVG can contain scripts (XSS), ICO rarely needed. */
export const ALLOWED_ASSET_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
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
      if (
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      )
        return mime;
      continue;
    }
    return mime;
  }
  return null;
}

/**
 * Validate asset file: size, client MIME in allowlist, and for images
 * optionally verify magic bytes match. Returns null if valid, or an error message.
 */
export function validateAssetFile(
  file: File,
  bytes: Uint8Array,
  options: { requireMagicMatchForImages?: boolean } = {}
): string | null {
  if (file.size > MAX_ASSET_FILE_BYTES) {
    return `File too large. Maximum size is ${MAX_ASSET_FILE_BYTES / 1024 / 1024} MB`;
  }
  const clientMime = (file.type || "").toLowerCase().trim();
  if (!clientMime) return "File type is required";
  if (!ALLOWED_ASSET_MIME_TYPES.has(clientMime)) {
    return "File type not allowed. Allowed: PNG, JPEG, GIF, WebP";
  }
  const { requireMagicMatchForImages = true } = options;
  if (requireMagicMatchForImages && clientMime.startsWith("image/")) {
    const magicMime = getMimeFromMagic(bytes);
    if (magicMime && magicMime !== clientMime) {
      return "File content does not match declared type";
    }
    if (
      ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(clientMime) &&
      !getMimeFromMagic(bytes)
    ) {
      return "File content does not match declared image type";
    }
  }
  return null;
}
