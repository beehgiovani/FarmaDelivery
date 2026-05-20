import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const scriptPath = "scripts/generate-session-secret.mjs";

const help = spawnSecret(["--help"]);
assert.equal(help.status, 0, `help should exit cleanly\n${help.stdout}\n${help.stderr}`);
assert.match(help.stdout, /secret:session/);
assert.doesNotMatch(help.stdout, /API_SESSION_SECRET="/);

const invalidBytes = spawnSecret(["bytes=31"]);
assert.notEqual(invalidBytes.status, 0, "bytes below the minimum should fail");
assert.match(invalidBytes.stderr, /bytes deve ser um inteiro de pelo menos 32/);

const check = spawnSecret(["bytes=32", "--check"]);
assert.equal(check.status, 0, `check should exit cleanly\n${check.stdout}\n${check.stderr}`);
const checkOutput = JSON.parse(check.stdout);
assert.equal(checkOutput.ok, true);
assert.equal(checkOutput.variable, "API_SESSION_SECRET");
assert.equal(checkOutput.randomBytes, 32);
assert.equal(checkOutput.characters >= 43, true);
assert.doesNotMatch(check.stdout, /API_SESSION_SECRET="/);

const generated = spawnSecret(["bytes=32"]);
assert.equal(generated.status, 0, `generation should exit cleanly\n${generated.stdout}\n${generated.stderr}`);
const match = generated.stdout.match(/^API_SESSION_SECRET="([A-Za-z0-9_-]{43,})"\r?\n?$/);
assert.ok(match, "generated secret should be a quoted base64url env assignment");
assert.equal(match[1].length, checkOutput.characters);

process.stdout.write(
  `${JSON.stringify(
    {
      mode: "session-secret-generator-self-test",
      ok: true,
      scenarios: 4,
    },
    null,
    2,
  )}\n`,
);

function spawnSecret(args) {
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
