import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

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
  return Boolean(process.env.DELIVERY_PROOF_STORAGE_DIR?.trim());
}

/** Resolve um arquivo de comprovante e bloqueia caminhos fora da pasta configurada. */
export function resolveDeliveryProofStorageFilePath(storagePath: string) {
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
