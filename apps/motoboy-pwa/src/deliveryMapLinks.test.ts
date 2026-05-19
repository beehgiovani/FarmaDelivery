import assert from "node:assert/strict";
import test from "node:test";
import { deliveryMapSearchUrl } from "./deliveryMapLinks";

test("uses delivery coordinates when opening the map", () => {
  const url = new URL(
    deliveryMapSearchUrl({
      address: "Rua Teste, 123",
      coordinates: { lat: -24.003825377135037, lng: -46.27390399967142 },
    })!,
  );

  assert.equal(url.searchParams.get("query"), "-24.003825377135037,-46.27390399967142");
});

test("uses trimmed delivery address when coordinates are unavailable", () => {
  const url = new URL(
    deliveryMapSearchUrl({
      address: "  Rua Teste, 123  ",
      coordinates: null,
    })!,
  );

  assert.equal(url.searchParams.get("query"), "Rua Teste, 123");
});

test("does not build a map url without coordinates or address", () => {
  assert.equal(deliveryMapSearchUrl({ address: "   ", coordinates: null }), null);
});
