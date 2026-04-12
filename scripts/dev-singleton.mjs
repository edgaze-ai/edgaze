#!/usr/bin/env node
/**
 * Prevents stale `next dev` + half-deleted `.next` (ENOENT on routes-manifest / middleware-manifest,
 * webpack pack rename races). See next.config.mjs webpack dev cache.
 */
import { spawn } from "child_process";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function getListenPids(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null`, {
      encoding: "utf8",
    }).trim();
    return out ? out.split("\n").map((x) => parseInt(x, 10)) : [];
  } catch {
    return [];
  }
}

function getCwd(pid) {
  try {
    const out = execSync(`lsof -a -p ${pid} -d cwd 2>/dev/null`, { encoding: "utf8" });
    const lines = out.trim().split("\n");
    if (lines.length < 2) return null;
    const parts = lines[1].trim().split(/\s+/);
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

function parsePort(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "-p" || a === "--port") && argv[i + 1]) return argv[i + 1];
  }
  return process.env.PORT || "3000";
}

/** If `.next` exists but dev output is incomplete, the server will 500 — wipe and rebuild. */
function removeBrokenNextDir() {
  const nextDir = path.join(root, ".next");
  if (!fs.existsSync(nextDir)) return;

  const required = [
    path.join(nextDir, "dev", "routes-manifest.json"),
    path.join(nextDir, "dev", "server", "middleware-manifest.json"),
  ];
  const missing = required.some((p) => !fs.existsSync(p));
  if (missing) {
    fs.rmSync(nextDir, { recursive: true, force: true });
  }
}

const forward = process.argv.slice(2);
const port = parsePort(forward);
let rootReal;
try {
  rootReal = fs.realpathSync(root);
} catch {
  process.exit(1);
}

if (process.platform !== "win32") {
  for (const pid of getListenPids(port)) {
    const cwd = getCwd(pid);
    if (!cwd) continue;
    try {
      if (fs.realpathSync(cwd) === rootReal) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* cwd path may be gone */
    }
  }
  await new Promise((r) => setTimeout(r, 400));
}

removeBrokenNextDir();

const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextCli)) {
  console.error("dev-singleton: next CLI not found. Run npm install.");
  process.exit(1);
}

const child = spawn(process.execPath, [nextCli, "dev", "--webpack", ...forward], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
