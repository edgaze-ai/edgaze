/**
 * Extract table-of-contents from markdown.
 * Only indexes markdown headings (##, ###, ####) — nothing else.
 * Used for "On this page" navigation (Mintlify-style).
 */

export type TOCItem = {
  id: string;
  text: string;
  level: number; // 2 = ##, 3 = ###, 4 = ####
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractToc(md: string): TOCItem[] {
  const lines = md.split("\n");
  const items: TOCItem[] = [];

  for (const raw of lines) {
    const line = raw;
    let level = 0;
    let text: string | null = null;

    if (line.startsWith("## ")) {
      level = 2;
      text = line.slice(3).trim();
    } else if (line.startsWith("### ")) {
      level = 3;
      text = line.slice(4).trim();
    } else if (line.startsWith("#### ")) {
      level = 4;
      text = line.slice(5).trim();
    }

    if (!text || level === 0) continue;

    const id = slugify(text);
    items.push({ id, text, level });
  }

  return items;
}
