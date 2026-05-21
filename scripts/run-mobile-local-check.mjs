import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";

const args = parseArgs(process.argv.slice(2));
const androidDir = join(process.cwd(), "apps", "motoboy");
const gradleCommand = process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew";

const steps = [
  { name: "PWA motoboy tests", command: "npm run test -w apps/motoboy-pwa", cwd: process.cwd() },
  { name: "PWA motoboy build", command: "npm run build -w apps/motoboy-pwa", cwd: process.cwd() },
  { name: "Android motoboy lint", command: `${gradleCommand} :app:lintDebug`, cwd: androidDir },
  { name: "Android motoboy unit tests", command: `${gradleCommand} :app:testDebugUnitTest`, cwd: androidDir },
  { name: "Android motoboy debug APK", command: `${gradleCommand} :app:assembleDebug`, cwd: androidDir },
];

if (args.list) {
  process.stdout.write(`${steps.map((step, index) => `${index + 1}. ${step.name}`).join("\n")}\n`);
  process.exit(0);
}

for (const step of steps) {
  process.stdout.write(`\n== ${step.name} ==\n`);
  const result = spawnSync(step.command, {
    cwd: step.cwd,
    env: process.env,
    shell: true,
    stdio: "inherit",
  });

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

if (process.exitCode === undefined) {
  const apkPath = join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  process.stdout.write(
    `\nMobile local check concluido. APK debug: ${relative(process.cwd(), apkPath)}\n`,
  );
}

function parseArgs(rawArgs) {
  let list = false;
  for (const arg of rawArgs) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Uso: npm run mobile:local-check\n" +
          "Ou: npm run mobile:local-check -- --list\n",
      );
      process.exit(0);
    }
    if (arg === "--list") {
      list = true;
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return { list };
}
