// src/app/blogs/utils/blogs.ts
import fs from "fs";
import path from "path";

export type BlogMeta = {
  slug: string;
  title: string;
  description: string;
  date?: string;
};

export type Blog = BlogMeta & {
  body: string;
};

const BLOGS_DIR = path.join(process.cwd(), "src", "app", "blogs", "content");

const ORDER: string[] = [
  "ai-prompts-no-distribution",
  "introducing-blogs",
];

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
  const dateMatch = raw.match(/^\s*date\s*=\s*["']([\s\S]*?)["']\s*$/m);

  const title = titleMatch?.[1]?.trim() || "Untitled";
  const description = descMatch?.[1]?.trim() || "";
  const date = dateMatch?.[1]?.trim();

  let body = raw;
  if (titleMatch?.[0]) body = body.replace(titleMatch[0], "").trimStart();
  if (descMatch?.[0]) body = body.replace(descMatch[0], "").trimStart();
  if (dateMatch?.[0]) body = body.replace(dateMatch[0], "").trimStart();

  return { title, description, date, body: body.trim() };
}

export function getAllBlogs(): BlogMeta[] {
  const metas: BlogMeta[] = [];

  for (const slug of ORDER) {
    const filePath = path.join(BLOGS_DIR, `${slug}.md`);
    const raw = safeRead(filePath);
    if (!raw) continue;

    const { title, description, date } = parseHeader(raw);
    metas.push({ slug, title, description, date });
  }

  // Also include any .md in content/ not in ORDER
  try {
    const files = fs.readdirSync(BLOGS_DIR).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      const slug = f.replace(/\.md$/, "");
      if (ORDER.includes(slug)) continue;
      const filePath = path.join(BLOGS_DIR, f);
      const raw = safeRead(filePath);
      if (!raw) continue;
      const { title, description, date } = parseHeader(raw);
      metas.push({ slug, title, description, date });
    }
  } catch {
    // dir may not exist yet
  }

  // Sort by date descending (newest first); items without date go last
  metas.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return metas;
}

export function getBlog(slug: string): Blog | null {
  const filePath = path.join(BLOGS_DIR, `${slug}.md`);
  const raw = safeRead(filePath);
  if (!raw) return null;

  const { title, description, date, body } = parseHeader(raw);
  return { slug, title, description, date, body };
}
