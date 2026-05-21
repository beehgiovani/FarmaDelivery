import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scriptPath = "scripts/check-production-env.mjs";
const baseEnv = {
  API_SESSION_SECRET: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "valid-service-key-for-check",
};

runCliScenario("shows help without running checks or leaking variable names", {
  args: ["--help"],
  expectExitCode: 0,
  expectStdout: /env:production:check/,
  rejectStdout: /API_SESSION_SECRET|SUPABASE_SECRET_KEY|FIREBASE/i,
});

runCliScenario("rejects unknown arguments before running checks", {
  args: ["unknown=value"],
  expectExitCode: 1,
  expectStderr: /Argumento desconhecido/,
  rejectStdout: /production-env-check/,
});

runScenario("rejects short session secret", {
  env: { ...baseEnv, API_SESSION_SECRET: "short" },
  expectExitCode: 1,
  expectFailureReason: "too_short_min_43_characters",
});

runScenario("warns when an explicit env file is missing", {
  args: ["file=env/missing-precheck-file.env"],
  env: baseEnv,
  expectWarningReason: "file_not_found",
});

runScenario("rejects invalid Supabase URL format", {
  env: { ...baseEnv, SUPABASE_URL: "not-a-url" },
  expectExitCode: 1,
  expectFailureReason: "invalid_url",
});

runScenario("warns when frontend API URL is not HTTPS for production", {
  env: { ...baseEnv, VITE_API_URL: "http://localhost:3333" },
  expectWarningReason: "placeholder_or_local_value",
});

runScenario("warns when proof storage looks local or ephemeral", {
  env: { ...baseEnv, DELIVERY_PROOF_STORAGE_DIR: "./uploads/delivery-proofs" },
  expectWarningReason: "local_or_ephemeral_storage_path",
});

runScenario("warns when DATABASE_URL is not a PostgreSQL URL", {
  env: { ...baseEnv, DATABASE_URL: "mysql://user:pass@db.example.com/app?sslmode=require" },
  expectWarningReason: "invalid_database_url_protocol",
});

runScenario("warns when DATABASE_URL is missing sslmode require", {
  env: { ...baseEnv, DATABASE_URL: "postgresql://user:pass@db.example.com/app" },
  expectWarningReason: "missing_sslmode_require",
});

runScenario("passes a PostgreSQL DATABASE_URL with credentials host and sslmode", {
  env: { ...baseEnv, DATABASE_URL: "postgresql://user:pass@db.example.com/app?sslmode=require" },
  expectPassedName: "DATABASE_URL",
});

runScenario("rejects Supabase publishable key used as server key", {
  env: { ...baseEnv, SUPABASE_SECRET_KEY: "sb_publishable_public_key_for_check" },
  expectExitCode: 1,
  expectFailureReason: "frontend_publishable_key_used_server_side",
});

runScenario("warns when Supabase secret key is exposed to frontend", {
  env: { ...baseEnv, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_server_key_for_check" },
  expectWarningReason: "server_secret_key_exposed_to_frontend",
});

runScenario("warns when VAPID is configured without Firebase Web Messaging fields", {
  env: {
    ...baseEnv,
    VITE_FIREBASE_WEB_PUSH_VAPID_KEY: "vapid-key-for-check",
  },
  expectWarningReason: "missing_or_placeholder_VITE_FIREBASE_API_KEY_VITE_FIREBASE_PROJECT_ID_VITE_FIREBASE_MESSAGING_SENDER_ID_VITE_FIREBASE_APP_ID",
});

runScenario("passes Firebase Web Push config when required Messaging fields exist", {
  env: {
    ...baseEnv,
    VITE_FIREBASE_WEB_PUSH_VAPID_KEY: "vapid-key-for-check",
    VITE_FIREBASE_API_KEY: "web-api-key-for-check",
    VITE_FIREBASE_PROJECT_ID: "project-id-for-check",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
    VITE_FIREBASE_APP_ID: "1:1234567890:web:abcdef",
  },
  expectPassedName: "Firebase Web Push config",
});

runScenario("warns on invalid Firebase Admin JSON", {
  env: {
    ...baseEnv,
    FIREBASE_SERVICE_ACCOUNT_JSON: "{invalid-json",
  },
  expectWarningReason: "invalid_json_FIREBASE_SERVICE_ACCOUNT_JSON",
});

runScenario("warns on invalid Firebase Admin base64", {
  env: {
    ...baseEnv,
    FIREBASE_SERVICE_ACCOUNT_BASE64: "not-valid-base64!",
  },
  expectWarningReason: "invalid_base64_service_account",
});

runScenario("passes Firebase Admin JSON with required service account fields", {
  env: {
    ...baseEnv,
    FIREBASE_SERVICE_ACCOUNT_JSON: serviceAccountJson(),
  },
  expectPassedName: "Firebase Admin credentials",
  forbiddenOutput: ["firebase-adminsdk@test.iam.gserviceaccount.com", "FAKE-PRIVATE-KEY"],
});

runScenario("passes Firebase Admin base64 with required service account fields", {
  env: {
    ...baseEnv,
    FIREBASE_SERVICE_ACCOUNT_BASE64: Buffer.from(serviceAccountJson()).toString("base64"),
  },
  expectPassedName: "Firebase Admin credentials",
  forbiddenOutput: ["firebase-adminsdk@test.iam.gserviceaccount.com", "FAKE-PRIVATE-KEY"],
});

const tempDir = mkdtempSync(join(tmpdir(), "farmadelivery-env-check-"));
try {
  const credentialsPath = join(tempDir, "service-account.json");
  writeFileSync(credentialsPath, serviceAccountJson(), "utf8");
  runScenario("passes GOOGLE_APPLICATION_CREDENTIALS file with required service account fields", {
    env: {
      ...baseEnv,
      GOOGLE_APPLICATION_CREDENTIALS: credentialsPath,
    },
    expectPassedName: "Firebase Admin credentials",
    forbiddenOutput: [credentialsPath, "firebase-adminsdk@test.iam.gserviceaccount.com", "FAKE-PRIVATE-KEY"],
  });
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

process.stdout.write(
  `${JSON.stringify(
    {
      mode: "production-env-check-self-test",
      ok: true,
      scenarios: 19,
    },
    null,
    2,
  )}\n`,
);

function runCliScenario(name, options) {
  const result = spawnSync(process.execPath, [scriptPath, ...(options.args ?? [])], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: buildEnv({}),
  });
  assert.equal(result.status, options.expectExitCode, `${name}: unexpected exit code\n${result.stdout}\n${result.stderr}`);
  if (options.expectStdout) assert.match(result.stdout, options.expectStdout, `${name}: stdout mismatch`);
  if (options.expectStderr) assert.match(result.stderr, options.expectStderr, `${name}: stderr mismatch`);
  if (options.rejectStdout) assert.doesNotMatch(result.stdout, options.rejectStdout, `${name}: stdout should not match`);
}

function runScenario(name, options) {
  const result = spawnSync(process.execPath, [scriptPath, ...(options.args ?? [])], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: buildEnv(options.env),
  });
  assert.equal(result.status, options.expectExitCode ?? 0, `${name}: unexpected exit code\n${result.stdout}\n${result.stderr}`);

  const output = JSON.parse(result.stdout);
  assert.equal(output.mode, "production-env-check", `${name}: unexpected mode`);

  if (options.expectFailureReason) {
    assert.ok(output.failures.some((check) => check.reason === options.expectFailureReason), `${name}: missing failure ${options.expectFailureReason}`);
  }
  if (options.expectWarningReason) {
    assert.ok(output.warnings.some((check) => check.reason === options.expectWarningReason), `${name}: missing warning ${options.expectWarningReason}`);
  }
  if (options.expectPassedName) {
    assert.ok(output.passed.some((check) => check.name === options.expectPassedName), `${name}: missing pass ${options.expectPassedName}`);
  }

  for (const forbidden of [...sensitiveEnvValues(options.env), ...(options.forbiddenOutput ?? [])]) {
    assert.equal(result.stdout.includes(forbidden), false, `${name}: leaked forbidden value`);
  }
}

function buildEnv(extraEnv) {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    ...extraEnv,
  };
}

function serviceAccountJson() {
  return JSON.stringify({
    project_id: "demo-project",
    client_email: "firebase-adminsdk@test.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nFAKE-PRIVATE-KEY\n-----END PRIVATE KEY-----\n",
  });
}

function sensitiveEnvValues(env) {
  const sensitiveNamePattern = /SECRET|KEY|PASSWORD|TOKEN|CREDENTIALS|DATABASE_URL|VAPID/i;
  return Object.entries(env)
    .filter(([key, value]) => sensitiveNamePattern.test(key) && typeof value === "string" && value.length >= 8)
    .map(([, value]) => value);
}
