import assert from "node:assert/strict";
import test from "node:test";
import { hasEnoughDeliveryPhoneDigits, normalizeDeliveryPhoneInput } from "./deliveryPhone";

test("formats local delivery phones with Guaruja area code while typing", () => {
  assert.equal(normalizeDeliveryPhoneInput("988881234"), "(13) 98888-1234");
  assert.equal(normalizeDeliveryPhoneInput("33551234"), "(13) 3355-1234");
  assert.equal(normalizeDeliveryPhoneInput("(13) 98888-1234"), "(13) 98888-1234");
});

test("preserves national phones from other Brazilian area codes", () => {
  assert.equal(normalizeDeliveryPhoneInput("11988881234"), "(11) 98888-1234");
  assert.equal(normalizeDeliveryPhoneInput("2133551234"), "(21) 3355-1234");
});

test("keeps international phones with DDI instead of forcing local area code", () => {
  assert.equal(normalizeDeliveryPhoneInput("+5513988881234"), "+55 (13) 98888-1234");
  assert.equal(normalizeDeliveryPhoneInput("+12125550123"), "+12125550123");
});

test("keeps partial phone input readable for counter attendants", () => {
  assert.equal(normalizeDeliveryPhoneInput(""), "");
  assert.equal(normalizeDeliveryPhoneInput("9"), "9");
  assert.equal(normalizeDeliveryPhoneInput("9888"), "9888");
  assert.equal(normalizeDeliveryPhoneInput("98888"), "98888");
});

test("validates delivery phones by digits instead of visual mask length", () => {
  assert.equal(hasEnoughDeliveryPhoneDigits("9"), false);
  assert.equal(hasEnoughDeliveryPhoneDigits("33551234"), true);
  assert.equal(hasEnoughDeliveryPhoneDigits("988881234"), true);
  assert.equal(hasEnoughDeliveryPhoneDigits("(13) 3355-1234"), true);
  assert.equal(hasEnoughDeliveryPhoneDigits("(13) 98888-1234"), true);
  assert.equal(hasEnoughDeliveryPhoneDigits("+12125550123"), true);
});
