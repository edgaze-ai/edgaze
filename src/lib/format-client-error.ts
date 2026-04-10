/**
 * Human-readable error text for UI (Supabase/Postgrest errors are plain objects, not Error).
 */
export function formatClientError(err: unknown): string {
  if (err instanceof Error) {
    return err.message.trim() || "Something went wrong.";
  }
  if (err == null) {
    return "Unknown error.";
  }
  if (typeof err === "string") {
    return err.trim() || "Unknown error.";
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const message = o.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    const details = o.details;
    if (typeof details === "string" && details.trim()) {
      return details.trim();
    }
    const desc = o.error_description;
    if (typeof desc === "string" && desc.trim()) {
      return desc.trim();
    }
    const parts: string[] = [];
    if (typeof o.code === "string" && o.code.trim()) {
      parts.push(o.code.trim());
    }
    if (typeof o.hint === "string" && o.hint.trim()) {
      parts.push(o.hint.trim());
    }
    if (parts.length) {
      return parts.join(" — ");
    }
    try {
      const json = JSON.stringify(o);
      if (json && json !== "{}") return json;
    } catch {
      /* ignore */
    }
    return "Unknown error.";
  }
  return String(err);
}
