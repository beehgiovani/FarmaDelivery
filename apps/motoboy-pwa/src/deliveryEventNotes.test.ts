import assert from "node:assert/strict";
import test from "node:test";
import { deliveryEventNotesText } from "./deliveryEventNotes";

test("trims delivery event notes before rendering", () => {
  assert.equal(deliveryEventNotesText({ notes: "  entregue na portaria  " }), "entregue na portaria");
});

test("returns null for blank or missing delivery event notes", () => {
  assert.equal(deliveryEventNotesText({ notes: "   " }), null);
  assert.equal(deliveryEventNotesText({ notes: null }), null);
  assert.equal(deliveryEventNotesText({}), null);
});
