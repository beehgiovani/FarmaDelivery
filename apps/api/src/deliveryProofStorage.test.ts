import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkDeliveryProofStorage,
  isDeliveryProofStorageConfigured,
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
