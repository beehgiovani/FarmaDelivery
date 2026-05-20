import { execFileSync } from "node:child_process";

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

const findings = trackedFiles.flatMap((file) => {
  if (allowList.has(file)) return [];
  return forbiddenRules
    .filter((rule) => rule.test(file))
    .map((rule) => ({ file, reason: rule.name }));
});

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
