import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const scriptPath = "scripts/run-mobile-local-check.mjs";

const help = spawnMobileCheck(["--help"]);
assert.equal(help.status, 0, `help should exit cleanly\n${help.stdout}\n${help.stderr}`);
assert.match(help.stdout, /mobile:local-check/);
assert.doesNotMatch(help.stdout, /API_SESSION_SECRET|SUPABASE_SECRET_KEY|FIREBASE/i);

const invalidArg = spawnMobileCheck(["unknown=value"]);
assert.notEqual(invalidArg.status, 0, "unknown arguments should fail before running mobile checks");
assert.match(invalidArg.stderr, /Argumento desconhecido/);
assert.equal(invalidArg.stdout.includes("== PWA motoboy tests =="), false, "invalid args should not start mobile checks");

const list = spawnMobileCheck(["--list"]);
assert.equal(list.status, 0, `list should exit cleanly\n${list.stdout}\n${list.stderr}`);
assert.match(list.stdout, /1\. PWA motoboy tests/);
assert.match(list.stdout, /2\. PWA motoboy build/);
assert.match(list.stdout, /Android motoboy lint/);
assert.match(list.stdout, /Android motoboy unit tests/);
assert.match(list.stdout, /Android motoboy debug APK/);
assert.equal(list.stdout.includes("== PWA motoboy tests =="), false, "list should not execute mobile checks");

const apiConfig = spawnMobileCheck(["--api-config"]);
assert.equal(apiConfig.status, 0, `api config should exit cleanly\n${apiConfig.stdout}\n${apiConfig.stderr}`);
assert.match(apiConfig.stdout, /^Android API:/);
assert.equal(apiConfig.stdout.includes("== PWA motoboy tests =="), false, "api config should not execute mobile checks");
assert.doesNotMatch(apiConfig.stdout, /API_SESSION_SECRET|SUPABASE_SECRET_KEY|FIREBASE/i);

process.stdout.write(
  `${JSON.stringify(
    {
      mode: "mobile-local-check-self-test",
      ok: true,
      scenarios: 4,
    },
    null,
    2,
  )}\n`,
);

function spawnMobileCheck(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
    },
  });
}
