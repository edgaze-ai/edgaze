// src/app/blogs/utils/blogs.ts
import fs from "fs";
import path from "path";
import { normalizeSafeSlug } from "@/lib/security/safe-values";

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

const ORDER = [
  {
    slug: "ai-prompts-no-distribution",
    href: "/blogs/ai-prompts-no-distribution",
  },
  {
    slug: "introducing-blogs",
    href: "/blogs/introducing-blogs",
  },
] as const;

export const BLOG_ROUTE_ORDER = ORDER.map((entry) => entry.href);

const BLOG_ROUTE_BY_SLUG = new Map(ORDER.map((entry) => [entry.slug, entry.href]));

export function getBlogHrefForSlug(slug: string) {
  return BLOG_ROUTE_BY_SLUG.get(slug) ?? "/blogs";
}

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

  for (const entry of ORDER) {
    const safeSlug = normalizeSafeSlug(entry.slug, { maxLength: 80 });
    if (!safeSlug) continue;
    const filePath = path.join(BLOGS_DIR, `${safeSlug}.md`);
    const raw = safeRead(filePath);
    if (!raw) continue;

    const { title, description, date } = parseHeader(raw);
    metas.push({ slug: safeSlug, title, description, date });
  }

  return metas;
}

export function getBlog(slug: string): Blog | null {
  const safeSlug = normalizeSafeSlug(slug, { maxLength: 80 });
  if (!safeSlug) return null;
  if (!BLOG_ROUTE_BY_SLUG.has(safeSlug)) return null;

  const filePath = path.join(BLOGS_DIR, `${safeSlug}.md`);
  const raw = safeRead(filePath);
  if (!raw) return null;

  const { title, description, date, body } = parseHeader(raw);
  return { slug: safeSlug, title, description, date, body };
}
