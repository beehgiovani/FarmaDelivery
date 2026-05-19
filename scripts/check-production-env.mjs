import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const env = {
  ...process.env,
  ...Object.assign({}, ...args.files.map(readEnvFile)),
};

const checks = [
  requireValue("API_SESSION_SECRET", { placeholderPattern: /troque_por|local-session-secret/i, minLength: 43 }),
  requireValue("SUPABASE_URL", { placeholderPattern: /PROJECT_REF/i }),
  requireOneOf(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_JWT"], { placeholderPattern: /xxx|secret_xxx|service_role/i }),
  requireValue("DATABASE_URL", { placeholderPattern: /USER:PASSWORD|POOLER_HOST|localhost/i, warningOnly: true }),
  requireValue("DELIVERY_PROOF_STORAGE_DIR", { warningOnly: true }),
  requireFirebaseAdminCredential(),
  requireValue("VITE_API_URL", { placeholderPattern: /localhost|127\.0\.0\.1/i, warningOnly: true }),
  requireValue("VITE_SUPABASE_URL", { placeholderPattern: /PROJECT_REF/i, warningOnly: true }),
  requireValue("VITE_SUPABASE_PUBLISHABLE_KEY", { placeholderPattern: /xxx|PROJECT_REF/i, warningOnly: true }),
  requireValue("VITE_FIREBASE_WEB_PUSH_VAPID_KEY", { placeholderPattern: /firebase_web_push|xxx/i, warningOnly: true }),
];

const failures = checks.filter((check) => check.status === "fail");
const warnings = checks.filter((check) => check.status === "warn");

process.stdout.write(
  `${JSON.stringify(
    {
      mode: "production-env-check",
      files: args.files,
      ok: failures.length === 0,
      failures: failures.map(publicCheck),
      warnings: warnings.map(publicCheck),
      passed: checks.filter((check) => check.status === "pass").map(publicCheck),
    },
    null,
    2,
  )}\n`,
);

if (failures.length > 0) {
  process.exitCode = 1;
}

function requireValue(name, options = {}) {
  const value = env[name]?.trim();
  if (!value) return { status: options.warningOnly ? "warn" : "fail", name, reason: "missing" };
  if (options.placeholderPattern?.test(value)) {
    return { status: options.warningOnly ? "warn" : "fail", name, reason: "placeholder_or_local_value" };
  }
  if (options.minLength && value.length < options.minLength) {
    return { status: options.warningOnly ? "warn" : "fail", name, reason: `too_short_min_${options.minLength}_characters` };
  }
  return { status: "pass", name };
}

function requireOneOf(names, options = {}) {
  const values = names.map((name) => env[name]?.trim()).filter(Boolean);
  if (values.length === 0) {
    return { status: "fail", name: names.join(" or "), reason: "missing_one_required_option" };
  }
  if (options.placeholderPattern && values.every((value) => options.placeholderPattern.test(value))) {
    return { status: "fail", name: names.join(" or "), reason: "placeholder_or_local_value" };
  }
  return { status: "pass", name: names.join(" or ") };
}

function requireFirebaseAdminCredential() {
  const hasJson = Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
  const hasBase64 = Boolean(env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim());
  const hasGoogleCredentials = Boolean(env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
  const triplet = `${env.FIREBASE_PROJECT_ID ?? ""} ${env.FIREBASE_CLIENT_EMAIL ?? ""} ${env.FIREBASE_PRIVATE_KEY ?? ""}`;
  const hasTriplet = Boolean(env.FIREBASE_PROJECT_ID?.trim() && env.FIREBASE_CLIENT_EMAIL?.trim() && env.FIREBASE_PRIVATE_KEY?.trim());
  const hasPlaceholderTriplet = /firebase_project_id|firebase_admin_client_email|\.\.\./i.test(triplet);

  if (hasJson || hasBase64 || hasGoogleCredentials || (hasTriplet && !hasPlaceholderTriplet)) {
    return { status: "pass", name: "Firebase Admin credentials" };
  }

  return {
    status: "warn",
    name: "Firebase Admin credentials",
    reason: "missing_or_placeholder_push_credentials",
  };
}

function parseArgs(rawArgs) {
  const files = [];
  for (const arg of rawArgs) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write("Uso: npm run env:production:check -- file=env/api.env file=env/admin.env\n");
      process.exit(0);
    }
    if (arg.startsWith("file=")) {
      files.push(arg.slice("file=".length));
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return { files };
}

function readEnvFile(filePath) {
  const resolved = resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) return {};

  return Object.fromEntries(
    readFileSync(resolved, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

function publicCheck(check) {
  return {
    name: check.name,
    reason: check.reason ?? "ok",
  };
}
