/** PostgREST / pg boolean scalars sometimes arrive as boolean or string (e.g. "t"). */
export function parseRpcBoolean(data: unknown): boolean | null {
  if (data === true || data === "true" || data === "t") return true;
  if (data === false || data === "false" || data === "f") return false;
  return null;
}
