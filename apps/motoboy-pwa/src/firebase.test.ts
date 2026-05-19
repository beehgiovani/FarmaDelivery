import assert from "node:assert/strict";
import test from "node:test";
import { canRequestFirebaseWebPushToken, hasFirebaseWebPushBrowserSupport, isFirebaseWebConfigComplete } from "./firebase";

test("does not request Web Push token without browser notification support", () => {
  assert.equal(canRequestFirebaseWebPushToken("valid-vapid-key", false), false);
});

test("does not request Web Push token without a configured VAPID key", () => {
  assert.equal(canRequestFirebaseWebPushToken("", true), false);
  assert.equal(canRequestFirebaseWebPushToken("   ", true), false);
  assert.equal(canRequestFirebaseWebPushToken(null, true), false);
});

test("does not request Web Push token without Firebase web config", () => {
  assert.equal(canRequestFirebaseWebPushToken("valid-vapid-key", true, false), false);
});

test("allows Web Push token request only when VAPID key browser support and Firebase config exist", () => {
  assert.equal(canRequestFirebaseWebPushToken("valid-vapid-key", true, true), true);
});

test("requires the Firebase fields needed by Messaging", () => {
  assert.equal(isFirebaseWebConfigComplete({}), false);
  assert.equal(isFirebaseWebConfigComplete({ apiKey: "key", projectId: "project", messagingSenderId: "sender", appId: "app" }), true);
});

test("reports no Web Push browser support in the Node test runtime", () => {
  assert.equal(hasFirebaseWebPushBrowserSupport(), false);
});
