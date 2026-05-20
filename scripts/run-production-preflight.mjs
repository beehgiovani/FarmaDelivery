import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const steps = [
  {
    name: "production env check",
    command: process.execPath,
    args: ["scripts/check-production-env.mjs", ...args.files.map((file) => `file=${file}`)],
  },
  { name: "tracked sensitive files check", command: "npm", args: ["run", "repo:sensitive:check"] },
  { name: "Supabase RLS static check", command: "npm", args: ["run", "db:rls:check"] },
  { name: "test suite", command: "npm", args: ["test"] },
  { name: "production build", command: "npm", args: ["run", "build"] },
];

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
  for (const arg of rawArgs) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write("Uso: npm run preflight:production -- file=env/api.env file=env/admin.env\n");
      process.exit(0);
    }
    if (arg.startsWith("file=")) {
      files.push(arg.slice("file=".length));
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return { files };
}
