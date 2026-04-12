#!/usr/bin/env node
/**
 * Dev helper: avoid the "empty .next + zombie next-server on :port" failure mode (500 + missing manifests).
 * - On macOS/Linux: SIGTERM any process listening on the chosen port whose cwd is this repo.
 * - If `.next` exists but dev manifests never materialized, remove it so the next boot can compile cleanly.
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

const nextDir = path.join(root, ".next");
const manifest = path.join(nextDir, "dev", "server", "middleware-manifest.json");
if (fs.existsSync(nextDir) && !fs.existsSync(manifest)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
}

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
