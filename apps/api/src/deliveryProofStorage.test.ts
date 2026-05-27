import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDeliveryProofStoragePath,
  checkDeliveryProofStorage,
  isDeliveryProofStorageConfigured,
  isSupabaseDeliveryProofStorageConfigured,
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
  await withProofStorageEnv({ dir: undefined, bucket: undefined, url: undefined, serviceKey: undefined }, async () => {
    assert.equal(isDeliveryProofStorageConfigured(), false);
    assert.equal(isSupabaseDeliveryProofStorageConfigured(), false);
    assert.equal(resolveDeliveryProofStorageRoot(), path.join(process.cwd(), "uploads", "delivery-proofs"));
  });
});

test("uses Supabase Storage path when bucket and credentials are configured", async () => {
  await withProofStorageEnv(
    {
      dir: undefined,
      bucket: "delivery-proofs",
      url: "https://project.supabase.co",
      serviceKey: "service-key",
    },
    async () => {
      assert.equal(isDeliveryProofStorageConfigured(), true);
      assert.equal(isSupabaseDeliveryProofStorageConfigured(), true);
      assert.equal(
        buildDeliveryProofStoragePath("delivery/1", "proof client.jpg"),
        "supabase://delivery-proofs/delivery_1/proof_client.jpg",
      );
      assert.throws(() => resolveDeliveryProofStorageFilePath("supabase://delivery-proofs/delivery-1/proof.jpg"), /Supabase Storage/);

      const status = await checkDeliveryProofStorage();
      assert.deepEqual(status, {
        configured: true,
        writable: true,
      });
    },
  );
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
  await withProofStorageEnv({ dir: value, bucket: undefined, url: undefined, serviceKey: undefined }, run);
}

async function withProofStorageEnv(
  values: {
    dir?: string;
    bucket?: string;
    url?: string;
    serviceKey?: string;
  },
  run: () => Promise<void>,
) {
  const previous = {
    dir: process.env.DELIVERY_PROOF_STORAGE_DIR,
    bucket: process.env.DELIVERY_PROOF_STORAGE_BUCKET,
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_JWT,
  };

  setOptionalEnv("DELIVERY_PROOF_STORAGE_DIR", values.dir);
  setOptionalEnv("DELIVERY_PROOF_STORAGE_BUCKET", values.bucket);
  setOptionalEnv("SUPABASE_URL", values.url);
  setOptionalEnv("SUPABASE_SERVICE_ROLE_JWT", values.serviceKey);

  try {
    await run();
  } finally {
    setOptionalEnv("DELIVERY_PROOF_STORAGE_DIR", previous.dir);
    setOptionalEnv("DELIVERY_PROOF_STORAGE_BUCKET", previous.bucket);
    setOptionalEnv("SUPABASE_URL", previous.url);
    setOptionalEnv("SUPABASE_SERVICE_ROLE_JWT", previous.serviceKey);
  }
}

function setOptionalEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
