// src/app/docs/utils/docs.ts
import fs from "fs";
import path from "path";
import { normalizeSafeSlug } from "@/lib/security/safe-values";

export type DocMeta = {
  slug: string; // canonical slug used in URL
  title: string;
  description: string;
  category?: string; // for grouping (e.g., "builder")
};

export type Doc = DocMeta & {
  body: string;
};

const DOCS_DIR = path.join(process.cwd(), "src", "app", "docs", "content");
const BUILDER_DIR = path.join(DOCS_DIR, "builder");

/**
 * Canonical URL slugs you want (OpenAI-ish clean slugs)
 * mapped to actual filenames you currently have.
 *
 * IMPORTANT: You currently have terms.md (not terms-of-service.md)
 * so we map terms-of-service -> terms.md
 */
const CANONICAL_TO_FILE: Record<string, string> = {
  changelog: "changelog.md",
  "edgaze-code": "edgaze-code.md",
  "privacy-policy": "privacy-policy.md",
  "terms-of-service": "terms.md",
  "seller-terms": "creator-terms.md",
  "creator-terms": "creator-terms.md",
  "refund-policy": "refund-policy.md",
  "acceptable-use-policy": "acceptable-use-policy.md",
  dmca: "dmca-ip-takedown.md",
  "community-guidelines": "community-guidelines.md",
  // Payments & monetization
  "payments-overview": "payments-overview.md",
  "payout-system": "payout-system.md",
  "marketplace-fees": "marketplace-fees.md",
  "creator-earnings": "creator-earnings.md",
  "workflow-run-policy": "workflow-run-policy.md",
  "infrastructure-cost-estimation": "infrastructure-cost-estimation.md",
  "chargeback-policy": "chargeback-policy.md",
  "creator-subscription-policy": "creator-subscription-policy.md",
  "pricing-limits": "pricing-limits.md",
  "fraud-abuse-policy": "fraud-abuse-policy.md",
  "content-disclaimer": "content-disclaimer.md",
  "platform-status-beta-disclaimer": "platform-status-beta-disclaimer.md",
  "security-responsible-disclosure": "security-responsible-disclosure.md",
  "creator-guidelines": "creator-guidelines.md",
  // Builder docs
  builder: "builder/index.md",
  "builder/workflow-studio": "builder/workflow-studio.md",
  "builder/prompt-studio": "builder/prompt-studio.md",
  "builder/templates": "builder/templates.md",
  "builder/api-vault": "builder/api-vault.md",
};

/**
 * Order for sidebar + default landing.
 * Builder docs are pinned at the top, then other docs.
 */
const ORDER: string[] = [
  "builder",
  "builder/workflow-studio",
  "builder/prompt-studio",
  "builder/templates",
  "builder/api-vault",
  "changelog",
  "edgaze-code",
  "privacy-policy",
  "terms-of-service",
  "creator-terms",
  "acceptable-use-policy",
  "dmca",
  "community-guidelines",
  "payments-overview",
  "payout-system",
  "marketplace-fees",
  "creator-earnings",
  "workflow-run-policy",
  "infrastructure-cost-estimation",
  "refund-policy",
  "chargeback-policy",
  "creator-subscription-policy",
  "pricing-limits",
  "fraud-abuse-policy",
  "content-disclaimer",
  "platform-status-beta-disclaimer",
  "security-responsible-disclosure",
  "creator-guidelines",
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
    const safeSlug = normalizeSafeSlug(slug, { allowSlash: true, maxLength: 80 });
    if (!safeSlug) continue;
    const filename = CANONICAL_TO_FILE[slug];
    if (!filename) continue; // TS + runtime safety

    const filePath = path.join(DOCS_DIR, filename);
    const raw = safeRead(filePath);
    if (!raw) continue;

    const { title, description } = parseHeader(raw);
    const category = safeSlug.startsWith("builder") ? "builder" : undefined;
    metas.push({ slug: safeSlug, title, description, category });
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
    const safeSlug = normalizeSafeSlug(f.replace(/\.md$/, ""), { allowSlash: true, maxLength: 80 });
    if (!safeSlug) continue;
    metas.push({ slug: safeSlug, title, description });
  }

  return metas;
}

export function getDoc(slug: string): Doc | null {
  const safeSlug = normalizeSafeSlug(slug, { allowSlash: true, maxLength: 80 });
  if (!safeSlug) return null;

  // Handle nested slugs like "builder/workflow-studio"
  if (safeSlug.includes("/")) {
    const parts = safeSlug.split("/");
    if (parts[0] === "builder" && parts.length === 2) {
      const filename = `${parts[1]}.md`;
      const filePath = path.join(BUILDER_DIR, filename);
      const raw = safeRead(filePath);
      if (!raw) return null;
      const { title, description, body } = parseHeader(raw);
      return { slug: safeSlug, title, description, body, category: "builder" };
    }
  }

  // 1) canonical mapped doc
  const mapped = CANONICAL_TO_FILE[safeSlug];
  if (mapped) {
    const filePath = path.join(DOCS_DIR, mapped);
    const raw = safeRead(filePath);
    if (!raw) return null;
    const { title, description, body } = parseHeader(raw);
    const category = safeSlug.startsWith("builder") ? "builder" : undefined;
    return { slug: safeSlug, title, description, body, category };
  }

  // 2) fallback: file name equals slug
  const filePath = path.join(DOCS_DIR, `${safeSlug}.md`);
  const raw = safeRead(filePath);
  if (!raw) return null;

  const { title, description, body } = parseHeader(raw);
  return { slug: safeSlug, title, description, body };
}
