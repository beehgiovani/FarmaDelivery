import assert from "node:assert/strict";
import test from "node:test";
import { addressHasDifferentCoordinates, findMatchingCustomerAddress, normalizeAddressIdentity } from "./customerAddressIdentity";

test("matches customer addresses ignoring case, accents and punctuation", () => {
  const existing = {
    id: "address-1",
    street: "Rua Seis",
    number: "5",
    neighborhood: "Vitoria Park",
    complement: "Casa",
  };

  const match = findMatchingCustomerAddress([existing], {
    street: "rua seis",
    number: "5",
    neighborhood: "Vitória Park",
    complement: "casa",
  });

  assert.equal(match?.id, "address-1");
});

test("keeps different complements as separate customer addresses", () => {
  const existing = {
    id: "address-1",
    street: "Rua Seis",
    number: "5",
    neighborhood: "Vitoria Park",
    complement: "Casa 1",
  };

  const match = findMatchingCustomerAddress([existing], {
    street: "Rua Seis",
    number: "5",
    neighborhood: "Vitoria Park",
    complement: "Casa 2",
  });

  assert.equal(match, undefined);
});

test("builds stable customer address identity from the delivery location fields", () => {
  assert.equal(
    normalizeAddressIdentity({
      street: " Av. dos Caiçaras ",
      number: "1171",
      neighborhood: "Astúrias",
      complement: "",
    }),
    "av dos caicaras|1171|asturias|",
  );
});

test("detects when saved address coordinates need to be refreshed", () => {
  assert.equal(addressHasDifferentCoordinates({ latitude: null, longitude: null }, { latitude: -23.9, longitude: -46.2 }), true);
  assert.equal(addressHasDifferentCoordinates({ latitude: "-23.9", longitude: "-46.2" }, { latitude: -23.9, longitude: -46.2 }), false);
});
