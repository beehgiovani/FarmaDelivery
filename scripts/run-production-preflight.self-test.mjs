import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const scriptPath = "scripts/run-production-preflight.mjs";

const help = spawnPreflight(["--help"]);
assert.equal(help.status, 0, `help should exit cleanly\n${help.stdout}\n${help.stderr}`);
assert.match(help.stdout, /preflight:production/);
assert.doesNotMatch(help.stdout, /API_SESSION_SECRET|SUPABASE_SECRET_KEY|FIREBASE/i);

const invalidArg = spawnPreflight(["unknown=value"]);
assert.notEqual(invalidArg.status, 0, "unknown arguments should fail before running preflight steps");
assert.match(invalidArg.stderr, /Argumento desconhecido/);
assert.equal(invalidArg.stdout.includes("== production env check =="), false, "invalid args should not start preflight steps");

const list = spawnPreflight(["--list"]);
assert.equal(list.status, 0, `list should exit cleanly\n${list.stdout}\n${list.stderr}`);
assert.match(list.stdout, /1\. session secret generator self-test/);
assert.match(list.stdout, /2\. production env check/);
assert.match(list.stdout, /tracked sensitive files self-test/);
assert.match(list.stdout, /Supabase RLS static check self-test/);
assert.match(list.stdout, /production build/);
assert.equal(list.stdout.includes("== production env check =="), false, "list should not execute preflight steps");

const probeRunner = spawnPreflight(["--probe-runner"]);
assert.equal(probeRunner.status, 0, `runner probe should exit cleanly\n${probeRunner.stdout}\n${probeRunner.stderr}`);
assert.match(probeRunner.stdout, /node command runner probe/);
assert.match(probeRunner.stdout, /node-ok/);
assert.match(probeRunner.stdout, /npm command runner probe/);
assert.doesNotMatch(probeRunner.stdout, /production env check/);

process.stdout.write(
  `${JSON.stringify(
    {
      mode: "production-preflight-self-test",
      ok: true,
      scenarios: 4,
    },
    null,
    2,
  )}\n`,
);

function spawnPreflight(args) {
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
