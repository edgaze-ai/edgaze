import { spawn } from "node:child_process";

const [, , ...args] = process.argv;
if (args.length === 0) {
  console.error("Usage: node scripts/run-npm-clean.mjs <npm args...>");
  process.exit(2);
}

const env = { ...process.env };
// These can point node-gyp at an ephemeral temp dir and cause flaky native installs.
delete env.npm_config_devdir;
delete env.NPM_CONFIG_DEVDIR;

const child = spawn("npm", args, {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

