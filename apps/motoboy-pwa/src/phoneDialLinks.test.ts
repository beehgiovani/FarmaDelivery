import assert from "node:assert/strict";
import test from "node:test";
import { phoneDialUrl } from "./phoneDialLinks";

test("keeps only digits in phone dial url", () => {
  assert.equal(phoneDialUrl("(13) 99123-4567"), "tel:13991234567");
});

test("returns an empty tel url when phone has no digits", () => {
  assert.equal(phoneDialUrl("sem telefone"), "tel:");
});
