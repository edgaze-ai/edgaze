function isAsciiAlphaNumeric(char: string) {
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

type SlugOptions = {
  allowSlash?: boolean;
  allowUnderscore?: boolean;
  maxLength?: number;
};

function normalizeSlugSegment(input: string, allowUnderscore: boolean, maxLength?: number) {
  const trimmed = input.trim().toLowerCase();
  let out = "";
  let lastWasDash = false;

  for (const char of trimmed) {
    const isAllowed =
      isAsciiAlphaNumeric(char) || char === "-" || (allowUnderscore && char === "_");

    if (isAllowed) {
      out += char;
      lastWasDash = char === "-";
    } else if (!lastWasDash && out.length > 0) {
      out += "-";
      lastWasDash = true;
    }

    if (maxLength && out.length >= maxLength) break;
  }

  while (out.startsWith("-")) out = out.slice(1);
  while (out.endsWith("-")) out = out.slice(0, -1);

  return maxLength ? out.slice(0, maxLength) : out;
}

export function normalizeSafeSlug(input: string, options: SlugOptions = {}) {
  const { allowSlash = false, allowUnderscore = false, maxLength } = options;
  if (!allowSlash) {
    return normalizeSlugSegment(input, allowUnderscore, maxLength);
  }

  const normalizedSegments = input
    .split("/")
    .map((segment) => normalizeSlugSegment(segment, allowUnderscore))
    .filter(Boolean);

  const joined = normalizedSegments.join("/");
  return maxLength ? joined.slice(0, maxLength) : joined;
}

function randomHex(bytes = 8) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const array = new Uint8Array(bytes);
    cryptoApi.getRandomValues(array);
    return Array.from(array, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  if (cryptoApi?.randomUUID) {
    return cryptoApi
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, bytes * 2);
  }

  const clock = `${Date.now().toString(16)}${Math.floor(performance.now()).toString(16)}`;
  return clock.padEnd(bytes * 2, "0").slice(0, bytes * 2);
}

export function createSecureId(prefix: string, bytes = 8) {
  return `${prefix}_${randomHex(bytes)}`;
}

export function sanitizeImageSrc(input: string | null | undefined) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  if (raw.startsWith("blob:")) return raw;
  if (raw.startsWith("data:image/")) return raw;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function createImageObjectUrl(file: File | null | undefined) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) return null;
  return URL.createObjectURL(file);
}

export function containsAny(text: string, needles: readonly string[]) {
  return needles.some((needle) => text.includes(needle));
}

export function toSafeDomId(input: string, prefix = "id") {
  const encoded = Array.from(input, (char) =>
    char.charCodeAt(0).toString(16).padStart(2, "0"),
  ).join("");
  return `${prefix}_${encoded || "0"}`;
}
