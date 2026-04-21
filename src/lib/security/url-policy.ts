const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

function hasOwn(obj: object, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPrivateIpv4Hostname(hostname: string) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;

  const [first, second] = octets;
  if (first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".local")
  );
}

export function sanitizeNavigationHref(input: string | null | undefined): string | null {
  const raw = String(input ?? "")
    .trim()
    .replace(CONTROL_CHARS, "");
  if (!raw || raw.startsWith("//")) return null;

  if (raw.startsWith("/") || raw.startsWith("#") || raw.startsWith("?")) {
    return raw;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function sanitizeDocPath(input: string | null | undefined): string {
  const raw = String(input ?? "").trim();
  const safe = sanitizeNavigationHref(raw);
  if (!safe || !safe.startsWith("/")) return "/docs";
  return safe;
}

export function sanitizeJsonScriptContent(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => {
    switch (char) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return char;
    }
  });
}

export function sanitizeLogText(value: unknown, maxLength = 300): string {
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
  const normalized = String(raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

export function createNullPrototypeRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

export function getOwnRecordValue<T>(record: Record<string, T> | null | undefined, key: string) {
  if (!record || !hasOwn(record, key)) return undefined;
  return Object.getOwnPropertyDescriptor(record, key)?.value as T | undefined;
}

export function setOwnRecordValue<T>(record: Record<string, T>, key: string, value: T) {
  if (key === "__proto__" || key === "constructor" || key === "prototype") return;
  Object.defineProperty(record, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

export function resolveTrustedUrl(
  input: string | null | undefined,
  options?: {
    allowedProtocols?: Array<"http:" | "https:">;
    allowedHosts?: string[];
    allowedHostnameSuffixes?: string[];
    allowLocalhost?: boolean;
    allowPrivateIpv4?: boolean;
  },
): URL | null {
  const raw = String(input ?? "")
    .trim()
    .replace(CONTROL_CHARS, "");
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const allowedProtocols = options?.allowedProtocols ?? ["https:", "http:"];
    if (!allowedProtocols.includes(parsed.protocol as "http:" | "https:")) return null;

    const hostname = parsed.hostname.trim().toLowerCase();
    if (!hostname) return null;

    if (!options?.allowLocalhost && isLocalHostname(hostname)) return null;
    if (!options?.allowPrivateIpv4 && isPrivateIpv4Hostname(hostname)) return null;

    if (options?.allowedHosts?.length) {
      if (!options.allowedHosts.some((host) => host.toLowerCase() === hostname)) return null;
    }

    if (options?.allowedHostnameSuffixes?.length) {
      if (
        !options.allowedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix.toLowerCase()))
      ) {
        return null;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}
