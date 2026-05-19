import assert from "node:assert/strict";
import test from "node:test";
import { assertProofUploadSize, MAX_PROOF_UPLOAD_BYTES, proofCompressionQualities, scaledImageSize } from "./deliveryProofImage";

test("keeps proof image dimensions when already inside max side", () => {
  assert.deepEqual(scaledImageSize(1200, 900), {
    width: 1200,
    height: 900,
  });
});

test("scales landscape proof image down to max side", () => {
  assert.deepEqual(scaledImageSize(4000, 3000), {
    width: 1600,
    height: 1200,
  });
});

test("scales portrait proof image down to max side", () => {
  assert.deepEqual(scaledImageSize(3000, 4000), {
    width: 1200,
    height: 1600,
  });
});

test("uses the same descending proof compression quality ladder as Android", () => {
  assert.deepEqual(proofCompressionQualities(), [0.82, 0.74, 0.66, 0.58, 0.5, 0.42]);
});

test("rejects empty or oversized proof uploads before sending to API", () => {
  assert.doesNotThrow(() => assertProofUploadSize(MAX_PROOF_UPLOAD_BYTES));
  assert.throws(() => assertProofUploadSize(0), /4 MB/);
  assert.throws(() => assertProofUploadSize(MAX_PROOF_UPLOAD_BYTES + 1), /4 MB/);
});
