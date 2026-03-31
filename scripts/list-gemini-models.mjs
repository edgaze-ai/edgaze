/**
 * List available Gemini models for the v1beta Generative Language API.
 *
 * Usage:
 *   GOOGLE_API_KEY=... node scripts/list-gemini-models.mjs
 *   GEMINI_API_KEY=... node scripts/list-gemini-models.mjs
 */
import fs from "node:fs";
import path from "node:path";

function parseDotenv(src) {
  const out = {};
  for (const rawLine of String(src || "").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let apiKey =
  process.env.EDGAZE_GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  // Best-effort: read repo-local .env.local (common Next.js dev setup).
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envRaw = fs.readFileSync(envPath, "utf8");
    const parsed = parseDotenv(envRaw);
    apiKey = parsed.EDGAZE_GEMINI_API_KEY || parsed.GOOGLE_API_KEY || parsed.GEMINI_API_KEY;
  } catch {
    // ignore
  }
}

if (!apiKey) {
  console.error(
    "Missing EDGAZE_GEMINI_API_KEY (or GOOGLE_API_KEY / GEMINI_API_KEY). Set it or add to .env.local.",
  );
  process.exit(1);
}

const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

async function listAllModels() {
  const out = [];
  let pageToken = undefined;

  // Paginate defensively (API may omit nextPageToken when done).
  for (let i = 0; i < 50; i++) {
    const url = new URL(baseUrl);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ListModels failed: ${res.status} ${body}`);
    }
    const json = await res.json();
    if (Array.isArray(json.models)) out.push(...json.models);
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}

function pad(s, n) {
  const str = String(s ?? "");
  return str.length >= n ? str : str + " ".repeat(n - str.length);
}

const models = await listAllModels();

// Sort by name for stable output.
models.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

const rows = models.map((m) => {
  const name = m?.name || "";
  const displayName = m?.displayName || "";
  const methods = Array.isArray(m?.supportedGenerationMethods)
    ? m.supportedGenerationMethods.join(",")
    : "";
  return { name, displayName, methods };
});

const nameW = Math.min(
  60,
  Math.max("name".length, ...rows.map((r) => r.name.length)),
);
const dispW = Math.min(
  36,
  Math.max("displayName".length, ...rows.map((r) => r.displayName.length)),
);

console.warn(`${pad("name", nameW)}  ${pad("displayName", dispW)}  supportedGenerationMethods`);
console.warn(`${"-".repeat(nameW)}  ${"-".repeat(dispW)}  --------------------------`);
for (const r of rows) {
  console.warn(
    `${pad(r.name, nameW)}  ${pad(r.displayName, dispW)}  ${r.methods}`,
  );
}

// Helpful filtered views (common debugging need).
const supportsGenerateContent = rows.filter((r) => r.methods.split(",").includes("generateContent"));
console.warn("\nModels supporting generateContent:");
for (const r of supportsGenerateContent) console.warn(`- ${r.name}`);

