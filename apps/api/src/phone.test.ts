import assert from "node:assert/strict";
import test from "node:test";
import { isPhoneIdentifier, normalizePhoneForStorage, phoneLookupCandidates } from "./phone";

test("normalizes phones to digits for storage", () => {
  assert.equal(normalizePhoneForStorage("(13) 99999-0000"), "13999990000");
  assert.equal(normalizePhoneForStorage("+55 (13) 99999-0000"), "5513999990000");
  assert.equal(normalizePhoneForStorage(""), undefined);
});

test("builds phone lookup candidates for masked legacy rows", () => {
  assert.deepEqual(phoneLookupCandidates("(13) 99999-0000"), ["(13) 99999-0000", "13999990000"]);
  assert.deepEqual(phoneLookupCandidates("13999990000"), ["13999990000", "(13) 99999-0000"]);
  assert.deepEqual(phoneLookupCandidates("5513999990000"), ["5513999990000", "(13) 99999-0000", "13999990000"]);
});

test("detects phone identifiers without treating emails as phones", () => {
  assert.equal(isPhoneIdentifier("(13) 99999-0000"), true);
  assert.equal(isPhoneIdentifier("13999990000"), true);
  assert.equal(isPhoneIdentifier("loja@example.com"), false);
});
