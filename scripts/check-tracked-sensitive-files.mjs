import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean);

const allowList = new Set([
  ".env.example",
  "apps/admin/.env.example",
  "apps/api/.env.example",
  "apps/motoboy-pwa/.env.example",
  "apps/motoboy/local.properties.example",
]);

const forbiddenRules = [
  { name: "env_file", test: (file) => file.endsWith("/.env") || file === ".env" },
  { name: "env_variant", test: (file) => /(^|\/)\.env\./.test(file) },
  { name: "env_directory", test: (file) => file.startsWith("env/") },
  { name: "google_services", test: (file) => file.endsWith("/google-services.json") || file === "google-services.json" },
  { name: "local_properties", test: (file) => file.endsWith("/local.properties") || file === "local.properties" },
  { name: "log_file", test: (file) => /\.(err\.)?log$/i.test(file) },
  { name: "android_package", test: (file) => /\.(apk|aab)$/i.test(file) },
  { name: "private_key_or_certificate", test: (file) => /\.(jks|keystore|p12|pfx|pem)$/i.test(file) },
  { name: "service_account_json", test: (file) => /(^|\/)(service-account|firebase-admin|google-credentials).*\.json$/i.test(file) },
];

const contentRules = [
  {
    name: "google_api_key",
    test: (content) => /AIza[0-9A-Za-z_-]{20,}/.test(content),
  },
];

const textFilePattern = /\.(cjs|css|html|js|json|jsx|kt|md|mjs|sql|toml|ts|tsx|txt|xml|yaml|yml)$/i;

const pathFindings = trackedFiles.flatMap((file) => {
  if (allowList.has(file)) return [];
  return forbiddenRules
    .filter((rule) => rule.test(file))
    .map((rule) => ({ file, reason: rule.name }));
});

const contentFindings = trackedFiles.flatMap((file) => {
  if (allowList.has(file) || !textFilePattern.test(file)) return [];
  const content = readFileSync(file, "utf8");
  return contentRules
    .filter((rule) => rule.test(content))
    .map((rule) => ({ file, reason: rule.name }));
});

const findings = [...pathFindings, ...contentFindings];

process.stdout.write(
  `${JSON.stringify(
    {
      mode: "tracked-sensitive-files-check",
      ok: findings.length === 0,
      checkedFiles: trackedFiles.length,
      findings,
    },
    null,
    2,
  )}\n`,
);

if (findings.length > 0) {
  process.exitCode = 1;
}
