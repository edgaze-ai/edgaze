import { spawn } from "node:child_process";

const [, , ...args] = process.argv;
if (args.length === 0) {
  console.error("Usage: node scripts/run-npm-clean.mjs <npm args...>");
  process.exit(2);
}

const ALLOWED_NPM_COMMANDS = new Set(["ci", "install", "run"]);
const SAFE_ARG_PATTERN = /^[a-zA-Z0-9:_./@=-]+$/;
const ALLOWED_RUN_SCRIPTS = new Set(["build", "lint", "typecheck", "test"]);

if (!ALLOWED_NPM_COMMANDS.has(args[0])) {
  console.error("Unsupported npm command.");
  process.exit(2);
}

if (args[0] === "run") {
  if (args.length < 2 || !ALLOWED_RUN_SCRIPTS.has(args[1])) {
    console.error("Unsupported npm run target.");
    process.exit(2);
  }
}

if (args.some((arg) => !SAFE_ARG_PATTERN.test(arg))) {
  console.error("Refusing to pass unsafe npm arguments.");
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
