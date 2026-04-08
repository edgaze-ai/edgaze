/** Normalize Auth/PostgREST/pg-like error shapes for admin-facing UI. */
export function flattenSupabaseError(err: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} {
  if (err == null) return { message: "Unknown error" };
  if (typeof err === "string") return { message: err };
  if (typeof err !== "object") return { message: String(err) };
  const o = err as Record<string, unknown>;
  const message =
    (typeof o.message === "string" && o.message.trim()) ||
    (typeof o.msg === "string" && o.msg.trim()) ||
    "";
  let details =
    (typeof o.details === "string" && o.details.trim() ? o.details.trim() : undefined) ||
    (typeof o.error_description === "string" && o.error_description.trim()
      ? o.error_description.trim()
      : undefined);
  const hint = typeof o.hint === "string" && o.hint.trim() ? o.hint.trim() : undefined;
  const codeRaw = o.code ?? o.name ?? o.status ?? o.error;
  const code =
    typeof codeRaw === "string"
      ? codeRaw
      : typeof codeRaw === "number"
        ? String(codeRaw)
        : undefined;
  if (o.cause != null && typeof o.cause === "object") {
    const c = flattenSupabaseError(o.cause);
    const causeLine = formatSupabaseErrorForDisplayInner(c);
    if (causeLine && causeLine !== c.message && !details?.includes(causeLine)) {
      details = details ? `${details}\n${causeLine}` : causeLine;
    } else if (!details && c.details) details = c.details;
  }
  return {
    message: message || "Request failed",
    code,
    details,
    hint,
  };
}

function formatSupabaseErrorForDisplayInner(f: {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}): string {
  const lines = [f.message];
  if (f.code) lines.push(`Code: ${f.code}`);
  if (f.details) lines.push(`Details: ${f.details}`);
  if (f.hint) lines.push(`Hint: ${f.hint}`);
  return lines.join("\n");
}

export function formatSupabaseErrorForDisplay(err: unknown): string {
  return formatSupabaseErrorForDisplayInner(flattenSupabaseError(err));
}
