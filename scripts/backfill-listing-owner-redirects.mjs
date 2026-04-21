#!/usr/bin/env node
/**
 * Bulk upsert listing_owner_redirects (historical old URLs after ownership transfer).
 *
 * Usage:
 *   node scripts/backfill-listing-owner-redirects.mjs ./redirects.json
 *
 * JSON file: array of
 *   { "listing_type": "workflow"|"prompt", "listing_id": "<uuid>", "from_owner_handle": "oldHandle", "edgaze_code": "code" }
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const file = process.argv[2];

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!file) {
  console.error("Usage: node scripts/backfill-listing-owner-redirects.mjs <path-to.json>");
  process.exit(1);
}

const repoRoot = fs.realpathSync(process.cwd());
const resolvedFile = fs.realpathSync(path.resolve(repoRoot, file));
const relativeFile = path.relative(repoRoot, resolvedFile);
if (relativeFile.startsWith("..") || path.isAbsolute(relativeFile)) {
  console.error("Input file must stay within the repository.");
  process.exit(1);
}
if (path.extname(resolvedFile).toLowerCase() !== ".json") {
  console.error("Input file must be a .json file.");
  process.exit(1);
}

const raw = fs.readFileSync(resolvedFile, "utf8");
const rows = JSON.parse(raw);
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("JSON must be a non-empty array");
  process.exit(1);
}

const normalized = rows.map((r) => {
  const from = String(r.from_owner_handle ?? "").trim().toLowerCase();
  const code = String(r.edgaze_code ?? "").trim();
  if (!from || !code || !r.listing_id || !r.listing_type) {
    throw new Error(`Invalid row: ${JSON.stringify(r)}`);
  }
  if (r.listing_type !== "workflow" && r.listing_type !== "prompt") {
    throw new Error(`listing_type must be workflow or prompt: ${JSON.stringify(r)}`);
  }
  return {
    listing_id: r.listing_id,
    listing_type: r.listing_type,
    from_owner_handle_norm: from,
    edgaze_code: code,
  };
});

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { error } = await supabase.from("listing_owner_redirects").upsert(normalized, {
  onConflict: "from_owner_handle_norm,edgaze_code",
});

if (error) {
  console.error(error);
  process.exit(1);
}

console.warn(`Upserted ${normalized.length} redirect row(s).`);
