import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const steps = [
  {
    name: "production env check",
    command: process.execPath,
    args: ["scripts/check-production-env.mjs", ...args.files.map((file) => `file=${file}`)],
  },
  { name: "tracked sensitive files self-test", command: "npm", args: ["run", "repo:sensitive:check:self-test"] },
  { name: "tracked sensitive files check", command: "npm", args: ["run", "repo:sensitive:check"] },
  { name: "Supabase RLS static check", command: "npm", args: ["run", "db:rls:check"] },
  { name: "test suite", command: "npm", args: ["test"] },
  { name: "production build", command: "npm", args: ["run", "build"] },
];

if (args.list) {
  process.stdout.write(`${steps.map((step, index) => `${index + 1}. ${step.name}`).join("\n")}\n`);
  process.exit(0);
}

for (const step of steps) {
  process.stdout.write(`\n== ${step.name} ==\n`);
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

function parseArgs(rawArgs) {
  const files = [];
  let list = false;
  for (const arg of rawArgs) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Uso: npm run preflight:production -- file=env/api.env file=env/admin.env\n" +
          "Ou: npm run preflight:production -- --list\n",
      );
      process.exit(0);
    }
    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg.startsWith("file=")) {
      files.push(arg.slice("file=".length));
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return { files, list };
}
