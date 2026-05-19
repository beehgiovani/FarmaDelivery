import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkDeliveryProofStorage,
  isDeliveryProofStorageConfigured,
  resolveDeliveryProofStorageFilePath,
  resolveDeliveryProofStorageRoot,
} from "./deliveryProofStorage";

test("resolves configured delivery proof storage path", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "farmadelivery-proof-storage-"));
  await withProofStorageDir(tempRoot, async () => {
    assert.equal(isDeliveryProofStorageConfigured(), true);
    assert.equal(resolveDeliveryProofStorageRoot(), tempRoot);

    const status = await checkDeliveryProofStorage();
    assert.deepEqual(status, {
      configured: true,
      writable: true,
    });
  });
  await rm(tempRoot, { recursive: true, force: true });
});

test("uses local delivery proof storage fallback when env is not configured", async () => {
  await withProofStorageDir(undefined, async () => {
    assert.equal(isDeliveryProofStorageConfigured(), false);
    assert.equal(resolveDeliveryProofStorageRoot(), path.join(process.cwd(), "uploads", "delivery-proofs"));
  });
});

test("resolves only proof files inside the configured storage root", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "farmadelivery-proof-storage-"));
  await withProofStorageDir(tempRoot, async () => {
    assert.equal(resolveDeliveryProofStorageFilePath("proof-1.jpg"), path.join(tempRoot, "proof-1.jpg"));
    assert.equal(resolveDeliveryProofStorageFilePath(path.join(tempRoot, "nested", "proof-2.jpg")), path.join(tempRoot, "nested", "proof-2.jpg"));
    assert.throws(() => resolveDeliveryProofStorageFilePath(path.join(tempRoot, "..", "outside.jpg")), /fora da pasta/);
  });
  await rm(tempRoot, { recursive: true, force: true });
});

test("deletes local proof binaries only inside configured storage root", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "farmadelivery-proof-storage-"));
  const proofPath = path.join(tempRoot, "proof-to-delete.jpg");
  await writeFile(proofPath, "proof", "utf8");

  await withProofStorageDir(tempRoot, async () => {
    const { deleteLocalProofBinary } = await import("./lgpdRetentionJob");
    await deleteLocalProofBinary({
      proofId: "proof-1",
      deliveryId: "delivery-1",
      storagePath: proofPath,
      preserveMetadata: true,
    });
    await assert.rejects(() => access(proofPath));
    await assert.rejects(
      () =>
        deleteLocalProofBinary({
          proofId: "proof-2",
          deliveryId: "delivery-1",
          storagePath: path.join(tempRoot, "..", "outside.jpg"),
          preserveMetadata: true,
        }),
      /fora da pasta/,
    );
  });
  await rm(tempRoot, { recursive: true, force: true });
});

async function withProofStorageDir(value: string | undefined, run: () => Promise<void>) {
  const previous = process.env.DELIVERY_PROOF_STORAGE_DIR;
  if (value === undefined) {
    delete process.env.DELIVERY_PROOF_STORAGE_DIR;
  } else {
    process.env.DELIVERY_PROOF_STORAGE_DIR = value;
  }

  try {
    await run();
  } finally {
    if (previous === undefined) {
      delete process.env.DELIVERY_PROOF_STORAGE_DIR;
    } else {
      process.env.DELIVERY_PROOF_STORAGE_DIR = previous;
    }
  }
}
