import assert from "node:assert/strict";
import test from "node:test";
import { canRequestFirebaseWebPushToken, hasFirebaseWebPushBrowserSupport } from "./firebase";

test("does not request Web Push token without browser notification support", () => {
  assert.equal(canRequestFirebaseWebPushToken("valid-vapid-key", false), false);
});

test("does not request Web Push token without a configured VAPID key", () => {
  assert.equal(canRequestFirebaseWebPushToken("", true), false);
  assert.equal(canRequestFirebaseWebPushToken("   ", true), false);
  assert.equal(canRequestFirebaseWebPushToken(null, true), false);
});

test("allows Web Push token request only when VAPID key and browser support exist", () => {
  assert.equal(canRequestFirebaseWebPushToken("valid-vapid-key", true), true);
});

test("reports no Web Push browser support in the Node test runtime", () => {
  assert.equal(hasFirebaseWebPushBrowserSupport(), false);
});
