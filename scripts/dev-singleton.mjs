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

function removeAsync(target) {
  fs.rm(target, { recursive: true, force: true }, () => {
    /* best effort */
  });
}

function retireDirectory(target, label) {
  if (!fs.existsSync(target)) return;
  const retired = path.join(root, `${path.basename(target)}.stale-${Date.now()}-${process.pid}`);
  try {
    fs.renameSync(target, retired);
    removeAsync(retired);
    process.stderr.write(`dev-singleton: retired stale ${label}\n`);
  } catch {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      process.stderr.write(`dev-singleton: removed stale ${label}\n`);
    } catch {
      /* ignore */
    }
  }
}

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

// ── 2. Clear stale Next.js output that breaks dev boot ───────────────────────
try {
  const nextDir = path.join(root, ".next");
  const devDir = path.join(nextDir, "dev");
  const hasProductionBuild = fs.existsSync(path.join(nextDir, "BUILD_ID"));

  // Next 16 writes dev output under `.next/dev`. A production `.next` left by
  // `next build` can make dev boot "ready" and then fail on missing dev
  // manifests. Move it aside instead of recursively deleting it on the hot path.
  if (hasProductionBuild) {
    retireDirectory(nextDir, ".next production build output");
  } else if (fs.existsSync(devDir)) {
    const requiredDevFiles = [
      path.join(devDir, "routes-manifest.json"),
      path.join(devDir, "server", "middleware-manifest.json"),
      path.join(devDir, "server", "pages-manifest.json"),
    ];
    if (requiredDevFiles.some((file) => !fs.existsSync(file))) {
      retireDirectory(devDir, ".next/dev cache");
    }
  }
} catch {
  /* ignore */
}

// ── 3. Spawn Next.js ─────────────────────────────────────────────────────────
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
