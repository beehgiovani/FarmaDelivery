import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type DeliveryProofBinary = {
  bytes: Buffer;
  mimeType: string;
};

const supabaseStoragePrefix = "supabase://";

/** Resolve a pasta de comprovantes, usando uploads local quando nao houver configuracao externa. */
export function resolveDeliveryProofStorageRoot() {
  const configuredPath = process.env.DELIVERY_PROOF_STORAGE_DIR?.trim();
  if (!configuredPath) {
    return path.join(process.cwd(), "uploads", "delivery-proofs");
  }

  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
}

/** Indica se producao apontou explicitamente onde guardar comprovantes. */
export function isDeliveryProofStorageConfigured() {
  return Boolean(process.env.DELIVERY_PROOF_STORAGE_BUCKET?.trim() || process.env.DELIVERY_PROOF_STORAGE_DIR?.trim());
}

/** Indica se os comprovantes devem ser gravados no Supabase Storage. */
export function isSupabaseDeliveryProofStorageConfigured() {
  return Boolean(resolveSupabaseStorageConfig());
}

/** Monta caminho seguro e estavel para o comprovante, seja bucket ou disco local. */
export function buildDeliveryProofStoragePath(deliveryId: string, storedFileName: string) {
  const safeDeliveryId = deliveryId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeFileName = storedFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${safeDeliveryId}/${safeFileName}`;
  const supabaseConfig = resolveSupabaseStorageConfig();

  if (supabaseConfig) {
    return `${supabaseStoragePrefix}${supabaseConfig.bucket}/${objectPath}`;
  }

  return path.join(resolveDeliveryProofStorageRoot(), objectPath);
}

/** Grava o binario do comprovante no destino configurado. */
export async function writeDeliveryProofBinary(storagePath: string, bytes: Buffer, mimeType: string) {
  const supabaseTarget = parseSupabaseStoragePath(storagePath);
  if (supabaseTarget) {
    await uploadSupabaseStorageObject(supabaseTarget.bucket, supabaseTarget.objectPath, bytes, mimeType);
    return;
  }

  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, bytes);
}

/** Le o binario do comprovante para download autenticado via API. */
export async function readDeliveryProofBinary(storagePath: string, fallbackMimeType: string): Promise<DeliveryProofBinary> {
  const supabaseTarget = parseSupabaseStoragePath(storagePath);
  if (supabaseTarget) {
    return downloadSupabaseStorageObject(supabaseTarget.bucket, supabaseTarget.objectPath, fallbackMimeType);
  }

  const { readFile } = await import("node:fs/promises");
  return {
    bytes: await readFile(resolveDeliveryProofStorageFilePath(storagePath)),
    mimeType: fallbackMimeType,
  };
}

/** Resolve um arquivo de comprovante e bloqueia caminhos fora da pasta configurada. */
export function resolveDeliveryProofStorageFilePath(storagePath: string) {
  if (parseSupabaseStoragePath(storagePath)) {
    throw new Error("Comprovante esta armazenado no Supabase Storage.");
  }

  const root = resolveDeliveryProofStorageRoot();
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.isAbsolute(storagePath) ? path.resolve(storagePath) : path.resolve(resolvedRoot, storagePath);
  const relativePath = path.relative(resolvedRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Caminho de comprovante fora da pasta configurada.");
  }

  return resolvedPath;
}

/** Testa se a pasta de comprovantes aceita escrita sem revelar caminho absoluto no healthcheck. */
export async function checkDeliveryProofStorage() {
  if (isSupabaseDeliveryProofStorageConfigured()) {
    return {
      configured: true,
      writable: true,
    };
  }

  const root = resolveDeliveryProofStorageRoot();
  const probePath = path.join(root, `.health-${randomUUID()}.tmp`);

  try {
    await mkdir(root, { recursive: true });
    await writeFile(probePath, "ok", "utf8");
    await unlink(probePath);
    return {
      configured: isDeliveryProofStorageConfigured(),
      writable: true,
    };
  } catch {
    await unlink(probePath).catch(() => undefined);
    return {
      configured: isDeliveryProofStorageConfigured(),
      writable: false,
    };
  }
}

/** Remove arquivo local quando o banco falha depois de gravar o comprovante no disco. */
export async function removeDeliveryProofBinaryIfExists(storagePath: string) {
  const supabaseTarget = parseSupabaseStoragePath(storagePath);
  if (supabaseTarget) {
    await deleteSupabaseStorageObjectIfExists(supabaseTarget.bucket, supabaseTarget.objectPath);
    return;
  }

  await unlink(storagePath).catch(() => undefined);
}

function parseSupabaseStoragePath(storagePath: string) {
  if (!storagePath.startsWith(supabaseStoragePrefix)) return null;
  const withoutPrefix = storagePath.slice(supabaseStoragePrefix.length);
  const [bucket, ...objectParts] = withoutPrefix.split("/");
  const objectPath = objectParts.join("/");
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

function resolveSupabaseStorageConfig() {
  const bucket = readEnv("DELIVERY_PROOF_STORAGE_BUCKET");
  const url = readEnv("SUPABASE_URL");
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_JWT") ?? readEnv("SUPABASE_SECRET_KEY");
  if (!bucket || !url || !serviceKey) return null;
  return { bucket, url: url.replace(/\/+$/, ""), serviceKey };
}

async function uploadSupabaseStorageObject(bucket: string, objectPath: string, bytes: Buffer, mimeType: string) {
  const config = requireSupabaseStorageConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStorageObjectPath(objectPath)}`, {
    method: "POST",
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": mimeType,
      "x-upsert": "false",
    },
    body: bytes,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase Storage upload failed with ${response.status}: ${text}`);
  }
}

async function downloadSupabaseStorageObject(bucket: string, objectPath: string, fallbackMimeType: string) {
  const config = requireSupabaseStorageConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStorageObjectPath(objectPath)}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase Storage download failed with ${response.status}`);
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") ?? fallbackMimeType,
  };
}

async function deleteSupabaseStorageObjectIfExists(bucket: string, objectPath: string) {
  const config = requireSupabaseStorageConfig();
  await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStorageObjectPath(objectPath)}`, {
    method: "DELETE",
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
  }).catch(() => undefined);
}

function requireSupabaseStorageConfig() {
  const config = resolveSupabaseStorageConfig();
  if (!config) throw new Error("Supabase Storage credentials are not configured.");
  return config;
}

function encodeStorageObjectPath(objectPath: string) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

/** Le variavel de ambiente aceitando valores colados com aspas no .env. */
function readEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  return value.replace(/^['"]|['"]$/g, "");
}
