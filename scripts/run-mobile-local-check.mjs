import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

process.stdout.write(`${androidApiConfigMessage()}\n`);

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

function androidApiConfigMessage() {
  const localPropertiesPath = join(androidDir, "local.properties");
  if (!existsSync(localPropertiesPath)) {
    return "Android API: sem local.properties; o app usara o padrao do emulador. Para aparelho fisico, configure uma URL acessivel pelo celular.";
  }

  const content = readFileSync(localPropertiesPath, "utf8");
  const apiUrl = content
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("farmadelivery.apiUrl="))
    ?.split("=")
    .slice(1)
    .join("=")
    .trim();

  if (!apiUrl) {
    return "Android API: farmadelivery.apiUrl ausente; o app usara o padrao do emulador. Para aparelho fisico, configure uma URL acessivel pelo celular.";
  }

  try {
    const parsed = new URL(apiUrl);
    if (parsed.hostname === "10.0.2.2") {
      return "Android API: configurada para o host do emulador Android. Para aparelho fisico, troque por HTTPS publicado ou host da rede local.";
    }
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
      return "Android API: configurada para loopback local, que nao atende aparelho fisico. Use 10.0.2.2 no emulador ou uma URL acessivel pelo celular.";
    }
    if (parsed.protocol !== "https:") {
      return "Android API: URL customizada sem HTTPS. Serve para rede local controlada; para producao, prefira HTTPS publicado.";
    }
    return "Android API: URL customizada com HTTPS configurada.";
  } catch {
    return "Android API: farmadelivery.apiUrl nao parece uma URL valida; revise local.properties antes do teste real.";
  }
}
