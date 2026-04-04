/**
 * Normalizes LLM markdown so common renderers (GFM / remark-gfm) accept it.
 * Models often emit pipe-separated rows without the required alignment row.
 */

const SEPARATOR_CELL = /^:?-{3,}:?$/;

function cellsFromPipeRow(line: string): string[] {
  return line
    .trim()
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function isSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) {
    return SEPARATOR_CELL.test(t);
  }
  const cells = cellsFromPipeRow(t);
  return cells.length >= 2 && cells.every((c) => SEPARATOR_CELL.test(c));
}

function isProbablyTableRow(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^#{1,6}\s/.test(t)) return false;
  if (/^[-*+]\s/.test(t)) return false;
  if (/^\d+\.\s/.test(t)) return false;
  if (/^>\s/.test(t)) return false;
  if (/^```/.test(t)) return false;
  return cellsFromPipeRow(t).length >= 2;
}

function columnCountFromRow(line: string): number {
  return cellsFromPipeRow(line).length;
}

function normalizePipeTablesInPlainText(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!isProbablyTableRow(line)) {
      out.push(line);
      i++;
      continue;
    }
    const block: string[] = [];
    while (i < lines.length) {
      const row = lines[i] ?? "";
      if (!isProbablyTableRow(row)) break;
      block.push(row);
      i++;
    }
    const head = block[0];
    const second = block[1];
    if (block.length < 2 || head === undefined || isSeparatorRow(head)) {
      out.push(...block);
      continue;
    }
    const n = columnCountFromRow(head);
    if (n < 2) {
      out.push(...block);
      continue;
    }
    const uniform = block.every((row) => columnCountFromRow(row) === n);
    if (uniform && second !== undefined && !isSeparatorRow(second)) {
      const sep = Array.from({ length: n }, () => "---").join(" | ");
      out.push(head, sep, ...block.slice(1));
    } else {
      out.push(...block);
    }
  }
  return out.join("\n");
}

/**
 * Split by fenced code blocks; only normalize text outside fences.
 */
export function normalizeWorkflowMarkdown(input: string): string {
  const normalized = input.replace(/\r\n/g, "\n");
  const parts = normalized.split(/(```[\s\S]*?```)/g);
  return parts
    .map((chunk) => (chunk.startsWith("```") ? chunk : normalizePipeTablesInPlainText(chunk)))
    .join("");
}
