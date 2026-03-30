/**
 * Value types for structured data passing: string, number, boolean, json, array, binary.
 */

export type ValueType = "string" | "number" | "boolean" | "json" | "array" | "binary";

export function inferValueType(v: unknown): ValueType {
  if (v === null || v === undefined) return "json";
  if (typeof v === "string") return "string";
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "boolean";
  if (Array.isArray(v)) return "array";
  if (typeof v === "object") return "json";
  return "json";
}

/**
 * Safely convert any value to a string, extracting meaningful content from
 * known wrapper shapes instead of producing "[object Object]".
 */
function objectToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(objectToString).filter(Boolean).join("\n\n");
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    // Input node shape { value, question }
    if ("value" in obj && "question" in obj) return objectToString(obj.value);
    // Condition passthrough
    if ("__conditionResult" in obj && "__passthrough" in obj) return objectToString(obj.__passthrough);
    // Common API response shapes
    for (const key of ["content", "text", "output", "message", "value", "result", "response", "answer"]) {
      if (typeof obj[key] === "string" && (obj[key] as string).trim()) return obj[key] as string;
    }
    try { return JSON.stringify(v, null, 2); } catch { return "[complex object]"; }
  }
  return String(v);
}

export function coerceToType(v: unknown, target: ValueType): unknown {
  switch (target) {
    case "string":
      if (v === null || v === undefined) return "";
      if (typeof v === "string") return v;
      return objectToString(v);
    case "number":
      if (typeof v === "number" && !Number.isNaN(v)) return v;
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    case "boolean":
      return Boolean(v);
    case "json":
      return v;
    case "array":
      return Array.isArray(v) ? v : [v];
    case "binary":
      return v;
    default:
      return v;
  }
}
