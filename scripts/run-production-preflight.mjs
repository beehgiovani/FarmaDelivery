import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const runnerProbeSteps = [
  { name: "node command runner probe", command: process.execPath, args: ["-e", "process.stdout.write('node-ok')"] },
  { name: "npm command runner probe", command: npmCommand, args: ["--version"] },
];
const steps = [
  { name: "session secret generator self-test", command: npmCommand, args: ["run", "secret:session:self-test"] },
  {
    name: "production env check",
    command: process.execPath,
    args: ["scripts/check-production-env.mjs", ...args.files.map((file) => `file=${file}`)],
  },
  { name: "tracked sensitive files self-test", command: npmCommand, args: ["run", "repo:sensitive:check:self-test"] },
  { name: "tracked sensitive files check", command: npmCommand, args: ["run", "repo:sensitive:check"] },
  { name: "Supabase RLS static check self-test", command: npmCommand, args: ["run", "db:rls:check:self-test"] },
  { name: "Supabase RLS static check", command: npmCommand, args: ["run", "db:rls:check"] },
  { name: "test suite", command: npmCommand, args: ["test"] },
  { name: "production build", command: npmCommand, args: ["run", "build"] },
];
const selectedSteps = args.probeRunner ? runnerProbeSteps : steps;

if (args.list) {
  process.stdout.write(`${selectedSteps.map((step, index) => `${index + 1}. ${step.name}`).join("\n")}\n`);
  process.exit(0);
}

for (const step of selectedSteps) {
  process.stdout.write(`\n== ${step.name} ==\n`);
  const result = runStep(step);

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

function parseArgs(rawArgs) {
  const files = [];
  let list = false;
  let probeRunner = false;
  for (const arg of rawArgs) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Uso: npm run preflight:production -- file=env/api.env file=env/admin.env\n" +
          "Ou: npm run preflight:production -- --list\n" +
          "Ou: npm run preflight:production -- --probe-runner\n",
      );
      process.exit(0);
    }
    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg === "--probe-runner") {
      probeRunner = true;
      continue;
    }
    if (arg.startsWith("file=")) {
      files.push(arg.slice("file=".length));
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return { files, list, probeRunner };
}

function runStep(step) {
  if (isWindows && step.command.toLowerCase().endsWith(".cmd")) {
    return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", windowsCommandLine(step.command, step.args)], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    });
  }

  return spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
}

function windowsCommandLine(command, args) {
  return [command, ...args].map(String).join(" ");
}
