import assert from "node:assert/strict";
import { buildTrackedSensitiveFilesReport } from "./check-tracked-sensitive-files.mjs";

const privateKeyBlock = [
  "-----BEGIN PRIVATE KEY-----",
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC".repeat(4),
  "-----END PRIVATE KEY-----",
].join("\n");

const files = {
  "apps/motoboy-pwa/src/firebase.ts": "export const key = 'AIzaSyA123456789012345678901234567890';",
  "apps/api/src/firebase-admin.json": JSON.stringify({ private_key: privateKeyBlock }),
  "apps/motoboy/app/google-services.json": "{}",
  "apps/api/.env.example": privateKeyBlock,
  "src/readme.md": "sem segredo real",
};

const report = buildTrackedSensitiveFilesReport(Object.keys(files), (file) => files[file] ?? "");
const findingReasons = report.findings.map((finding) => `${finding.file}:${finding.reason}`);

assert.equal(report.ok, false);
assert.equal(report.checkedFiles, Object.keys(files).length);
assert.equal(findingReasons.includes("apps/motoboy-pwa/src/firebase.ts:google_api_key"), true);
assert.equal(findingReasons.includes("apps/api/src/firebase-admin.json:service_account_json"), true);
assert.equal(findingReasons.includes("apps/api/src/firebase-admin.json:private_key_block"), true);
assert.equal(findingReasons.includes("apps/motoboy/app/google-services.json:google_services"), true);
assert.equal(findingReasons.some((finding) => finding.startsWith("apps/api/.env.example:")), false);

process.stdout.write(
  `${JSON.stringify(
    {
      mode: "tracked-sensitive-files-check-self-test",
      ok: true,
      scenarios: 1,
    },
    null,
    2,
  )}\n`,
);
