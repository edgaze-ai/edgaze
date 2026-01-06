// src/app/docs/utils/docs.ts
import fs from "fs";
import path from "path";

export type DocMeta = {
  slug: string; // canonical slug used in URL
  title: string;
  description: string;
};

export type Doc = DocMeta & {
  body: string;
};

const DOCS_DIR = path.join(process.cwd(), "src", "app", "docs", "content");

/**
 * Canonical URL slugs you want (OpenAI-ish clean slugs)
 * mapped to actual filenames you currently have.
 *
 * IMPORTANT: You currently have terms.md (not terms-of-service.md)
 * so we map terms-of-service -> terms.md
 */
const CANONICAL_TO_FILE: Record<string, string> = {
  changelog: "changelog.md",
  "privacy-policy": "privacy-policy.md",
  "terms-of-service": "terms.md",
};

/**
 * Order for sidebar + default landing.
 * Changelog must be first + default open.
 */
const ORDER: string[] = ["changelog", "privacy-policy", "terms-of-service"];

function safeRead(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseHeader(raw: string) {
  const titleMatch = raw.match(/^\s*title\s*=\s*["']([\s\S]*?)["']\s*$/m);
  const descMatch = raw.match(/^\s*description\s*=\s*["']([\s\S]*?)["']\s*$/m);

  const title = titleMatch?.[1]?.trim() || "Untitled";
  const description = descMatch?.[1]?.trim() || "";

  let body = raw;
  if (titleMatch?.[0]) body = body.replace(titleMatch[0], "").trimStart();
  if (descMatch?.[0]) body = body.replace(descMatch[0], "").trimStart();

  return { title, description, body: body.trim() };
}

export function getAllDocs(): DocMeta[] {
  // Build from canonical list first (ensures stable order + slugs)
  const metas: DocMeta[] = [];

  for (const slug of ORDER) {
    const filename = CANONICAL_TO_FILE[slug];
    if (!filename) continue; // TS + runtime safety

    const filePath = path.join(DOCS_DIR, filename);
    const raw = safeRead(filePath);
    if (!raw) continue;

    const { title, description } = parseHeader(raw);
    metas.push({ slug, title, description });
  }

  // Also include any extra .md files dropped into content/ that are not in map
  // They will be accessible at /docs/<filename-without-ext>
  const knownFiles = new Set(Object.values(CANONICAL_TO_FILE));
  const files = (() => {
    try {
      return fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
    } catch {
      return [];
    }
  })();

  for (const f of files) {
    if (knownFiles.has(f)) continue;
    const filePath = path.join(DOCS_DIR, f);
    const raw = safeRead(filePath);
    if (!raw) continue;

    const { title, description } = parseHeader(raw);
    metas.push({ slug: f.replace(/\.md$/, ""), title, description });
  }

  return metas;
}

export function getDoc(slug: string): Doc | null {
  // 1) canonical mapped doc
  const mapped = CANONICAL_TO_FILE[slug];
  if (mapped) {
    const filePath = path.join(DOCS_DIR, mapped);
    const raw = safeRead(filePath);
    if (!raw) return null;
    const { title, description, body } = parseHeader(raw);
    return { slug, title, description, body };
  }

  // 2) fallback: file name equals slug
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  const raw = safeRead(filePath);
  if (!raw) return null;

  const { title, description, body } = parseHeader(raw);
  return { slug, title, description, body };
}
