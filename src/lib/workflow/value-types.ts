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

export function coerceToType(v: unknown, target: ValueType): unknown {
  switch (target) {
    case "string":
      return v === null || v === undefined ? "" : String(v);
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
