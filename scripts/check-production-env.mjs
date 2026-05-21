import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const inputFiles = args.files.map(readEnvFile);
const env = {
  ...process.env,
  ...Object.assign({}, ...inputFiles.map((file) => file.values)),
};

const checks = [
  ...inputFiles.filter((file) => !file.exists).map((file) => ({
    status: "warn",
    name: `env file ${file.filePath}`,
    reason: "file_not_found",
  })),
  requireValue("API_SESSION_SECRET", { placeholderPattern: /troque_por|local-session-secret/i, minLength: 43 }),
  requireUrl("SUPABASE_URL", { placeholderPattern: /PROJECT_REF/i, allowedProtocols: ["https:"] }),
  requireSupabaseServerKey(),
  requirePostgresDatabaseUrl(),
  requireDeliveryProofStorageDir(),
  requireFirebaseAdminCredential(),
  requireUrl("VITE_API_URL", { placeholderPattern: /localhost|127\.0\.0\.1/i, warningOnly: true, allowedProtocols: ["https:"] }),
  requireUrl("VITE_SUPABASE_URL", { placeholderPattern: /PROJECT_REF/i, warningOnly: true, allowedProtocols: ["https:"] }),
  requireSupabasePublishableKey(),
  requireValue("VITE_FIREBASE_WEB_PUSH_VAPID_KEY", { placeholderPattern: /firebase_web_push|xxx/i, warningOnly: true }),
  requireFirebaseWebPushConfig(),
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

function requireUrl(name, options = {}) {
  const value = env[name]?.trim();
  const valueCheck = requireValue(name, options);
  if (valueCheck.status !== "pass") return valueCheck;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { status: options.warningOnly ? "warn" : "fail", name, reason: "invalid_url" };
  }

  if (options.allowedProtocols && !options.allowedProtocols.includes(parsed.protocol)) {
    return { status: options.warningOnly ? "warn" : "fail", name, reason: "invalid_url_protocol" };
  }

  return { status: "pass", name };
}

function requireDeliveryProofStorageDir() {
  const value = env.DELIVERY_PROOF_STORAGE_DIR?.trim();
  const valueCheck = requireValue("DELIVERY_PROOF_STORAGE_DIR", { warningOnly: true });
  if (valueCheck.status !== "pass") return valueCheck;

  if (
    value.startsWith("./") ||
    value.startsWith(".\\") ||
    /^uploads([\\/]|$)/i.test(value) ||
    /tmp|temp/i.test(value)
  ) {
    return {
      status: "warn",
      name: "DELIVERY_PROOF_STORAGE_DIR",
      reason: "local_or_ephemeral_storage_path",
    };
  }

  return { status: "pass", name: "DELIVERY_PROOF_STORAGE_DIR" };
}

function requirePostgresDatabaseUrl() {
  const name = "DATABASE_URL";
  const value = env[name]?.trim();
  const valueCheck = requireValue(name, {
    placeholderPattern: /USER:PASSWORD|POOLER_HOST|localhost/i,
    warningOnly: true,
  });
  if (valueCheck.status !== "pass") return valueCheck;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { status: "warn", name, reason: "invalid_url" };
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    return { status: "warn", name, reason: "invalid_database_url_protocol" };
  }
  if (!parsed.hostname || !parsed.username || !parsed.password) {
    return { status: "warn", name, reason: "missing_database_url_credentials_or_host" };
  }
  if (parsed.searchParams.get("sslmode") !== "require") {
    return { status: "warn", name, reason: "missing_sslmode_require" };
  }

  return { status: "pass", name };
}

function requireSupabaseServerKey() {
  const names = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_JWT"];
  const values = names.map((name) => ({ name, value: env[name]?.trim() })).filter((item) => item.value);
  if (values.length === 0) {
    return { status: "fail", name: names.join(" or "), reason: "missing_one_required_option" };
  }
  if (values.every((item) => /xxx|secret_xxx|service_role/i.test(item.value))) {
    return { status: "fail", name: names.join(" or "), reason: "placeholder_or_local_value" };
  }
  if (values.every((item) => looksLikeSupabasePublishableKey(item.value))) {
    return { status: "fail", name: names.join(" or "), reason: "frontend_publishable_key_used_server_side" };
  }

  return { status: "pass", name: names.join(" or ") };
}

function requireSupabasePublishableKey() {
  const name = "VITE_SUPABASE_PUBLISHABLE_KEY";
  const value = env[name]?.trim();
  const valueCheck = requireValue(name, { placeholderPattern: /xxx|PROJECT_REF/i, warningOnly: true });
  if (valueCheck.status !== "pass") return valueCheck;

  if (looksLikeSupabaseSecretKey(value)) {
    return { status: "warn", name, reason: "server_secret_key_exposed_to_frontend" };
  }

  return { status: "pass", name };
}

function looksLikeSupabaseSecretKey(value) {
  return typeof value === "string" && (/^sb_secret_/i.test(value) || /service_role/i.test(value));
}

function looksLikeSupabasePublishableKey(value) {
  return typeof value === "string" && (/^sb_publishable_/i.test(value) || /\banon\b/i.test(value));
}

function requireFirebaseAdminCredential() {
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) return validateFirebaseServiceAccountJson(json, "FIREBASE_SERVICE_ACCOUNT_JSON");

  const base64 = env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (base64) {
    if (!looksLikeBase64(base64)) {
      return {
        status: "warn",
        name: "Firebase Admin credentials",
        reason: "invalid_base64_service_account",
      };
    }
    return validateFirebaseServiceAccountJson(
      Buffer.from(base64, "base64").toString("utf8"),
      "FIREBASE_SERVICE_ACCOUNT_BASE64",
    );
  }

  const googleCredentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (googleCredentialsPath) {
    if (/caminho|path|xxx/i.test(googleCredentialsPath)) {
      return {
        status: "warn",
        name: "Firebase Admin credentials",
        reason: "placeholder_google_application_credentials",
      };
    }
    const resolvedGoogleCredentialsPath = resolve(process.cwd(), googleCredentialsPath);
    if (!existsSync(resolvedGoogleCredentialsPath)) {
      return {
        status: "warn",
        name: "Firebase Admin credentials",
        reason: "google_application_credentials_file_not_found_locally",
      };
    }
    return validateFirebaseServiceAccountJson(
      readFileSync(resolvedGoogleCredentialsPath, "utf8"),
      "GOOGLE_APPLICATION_CREDENTIALS",
    );
  }

  const triplet = `${env.FIREBASE_PROJECT_ID ?? ""} ${env.FIREBASE_CLIENT_EMAIL ?? ""} ${env.FIREBASE_PRIVATE_KEY ?? ""}`;
  const hasTriplet = Boolean(env.FIREBASE_PROJECT_ID?.trim() && env.FIREBASE_CLIENT_EMAIL?.trim() && env.FIREBASE_PRIVATE_KEY?.trim());
  const hasPlaceholderTriplet = /firebase_project_id|firebase_admin_client_email|\.\.\./i.test(triplet);

  if (
    hasTriplet &&
    !hasPlaceholderTriplet &&
    looksLikeFirebasePrivateKey(env.FIREBASE_PRIVATE_KEY) &&
    looksLikeFirebaseClientEmail(env.FIREBASE_CLIENT_EMAIL)
  ) {
    return { status: "pass", name: "Firebase Admin credentials" };
  }

  if (hasTriplet) {
    return {
      status: "warn",
      name: "Firebase Admin credentials",
      reason: "invalid_or_placeholder_triplet_credentials",
    };
  }

  return {
    status: "warn",
    name: "Firebase Admin credentials",
    reason: "missing_or_placeholder_push_credentials",
  };
}

function validateFirebaseServiceAccountJson(rawJson, sourceName) {
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      status: "warn",
      name: "Firebase Admin credentials",
      reason: `invalid_json_${sourceName}`,
    };
  }

  const projectId = parsed.projectId ?? parsed.project_id;
  const clientEmail = parsed.clientEmail ?? parsed.client_email;
  const privateKey = parsed.privateKey ?? parsed.private_key;
  if (projectId && looksLikeFirebaseClientEmail(clientEmail) && looksLikeFirebasePrivateKey(privateKey)) {
    return { status: "pass", name: "Firebase Admin credentials" };
  }

  return {
    status: "warn",
    name: "Firebase Admin credentials",
    reason: `missing_or_placeholder_fields_${sourceName}`,
  };
}

function looksLikeFirebaseClientEmail(value) {
  return typeof value === "string" && value.includes("@") && value.includes(".iam.gserviceaccount.com");
}

function looksLikeFirebasePrivateKey(value) {
  return typeof value === "string" && value.includes("BEGIN PRIVATE KEY") && value.includes("END PRIVATE KEY");
}

function looksLikeBase64(value) {
  const normalized = value.replace(/\s/g, "");
  return normalized.length > 0 && normalized.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
}

function requireFirebaseWebPushConfig() {
  const vapidKey = env.VITE_FIREBASE_WEB_PUSH_VAPID_KEY?.trim();
  if (!vapidKey || /firebase_web_push|xxx/i.test(vapidKey)) {
    return {
      status: "warn",
      name: "Firebase Web Push config",
      reason: "missing_or_placeholder_vapid_key",
    };
  }

  const requiredNames = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ];
  const missingNames = requiredNames.filter((name) => {
    const value = env[name]?.trim();
    return !value || /firebase_|PROJECT_ID|MESSAGING_SENDER_ID|xxx/i.test(value);
  });

  if (missingNames.length > 0) {
    return {
      status: "warn",
      name: "Firebase Web Push config",
      reason: `missing_or_placeholder_${missingNames.join("_")}`,
    };
  }

  return { status: "pass", name: "Firebase Web Push config" };
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
  if (!existsSync(resolved)) return { filePath, exists: false, values: {} };

  const values = Object.fromEntries(
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
  return { filePath, exists: true, values };
}

function publicCheck(check) {
  return {
    name: check.name,
    reason: check.reason ?? "ok",
  };
}
