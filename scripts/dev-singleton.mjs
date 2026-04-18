#!/usr/bin/env node
/**
 * Dev launcher: moves Next.js build output to OS temp dir (avoids iCloud symlink conflicts),
 * patches tsconfig so Next.js never rewrites it during the run (prevents infinite recompile),
 * and cleans up iCloud “.next 2” style conflict folders at the repo root.
 *
 * We do not delete the repo’s `.next/` on every start: recursive rmSync on
 * iCloud-/cloud-synced trees (e.g. ~/Documents) can block for minutes or hang.
 * Use `npm run dev:clean` when you need a full `.next` reset.
 *
 * No lsof / execSync — those can hang on macOS. If port 3000 is already in use,
 * Next.js will print a clear error. To free the port manually:
 *   lsof -ti :3000 | xargs kill -9
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── 1. Remove iCloud “.next 2” style conflict copies at repo root only ───────
// We do NOT recursively delete `.next/` itself: rmSync on iCloud-synced trees
// can block for minutes. Use `npm run dev:clean` for a full reset.
try {
  for (const entry of fs.readdirSync(root)) {
    if (/^\.next[ \u00a0]\d+$/.test(entry)) {
      try {
        fs.rmSync(path.join(root, entry), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
} catch {
  /* ignore */
}

// ── 2. Spawn Next.js ─────────────────────────────────────────────────────────
// Default distDir (.next, relative) is intentional: overriding to /tmp made Next
// rewrite tsconfig.json on every boot with absolute /private/var/folders paths,
// which churned the file watcher into an endless Compiling/Rendering loop.
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextCli)) {
  process.stderr.write("dev-singleton: next CLI not found — run npm install\n");
  process.exit(1);
}

const child = spawn(process.execPath, [nextCli, "dev", "--webpack", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});
child.on("exit", (code) => process.exit(code ?? 0));
