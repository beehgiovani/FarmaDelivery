import assert from "node:assert/strict";
import test from "node:test";
import { detectImageMimeType, extensionForImageMimeType, sanitizeDownloadFileName } from "./routes/deliveries";

test("detects supported delivery proof image signatures", () => {
  assert.equal(detectImageMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    detectImageMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  assert.equal(detectImageMimeType(Buffer.from("RIFFxxxxWEBP", "ascii")), "image/webp");
});

test("rejects unsupported or truncated delivery proof content", () => {
  assert.equal(detectImageMimeType(Buffer.from("not-an-image", "utf8")), null);
  assert.equal(detectImageMimeType(Buffer.from([0xff, 0xd8])), null);
  assert.equal(detectImageMimeType(Buffer.from("RIFFxxxxNOPE", "ascii")), null);
});

test("maps delivery proof image mime types to storage extensions", () => {
  assert.equal(extensionForImageMimeType("image/jpeg"), "jpg");
  assert.equal(extensionForImageMimeType("image/png"), "png");
  assert.equal(extensionForImageMimeType("image/webp"), "webp");
});

test("sanitizes delivery proof download filenames for response headers", () => {
  assert.equal(sanitizeDownloadFileName('proof"\r\nx-header: bad.jpg'), "proofx-header_ bad.jpg");
  assert.equal(sanitizeDownloadFileName("../proof\\client.png"), ".._proof_client.png");
  assert.equal(sanitizeDownloadFileName("   "), "delivery-proof.jpg");
});
