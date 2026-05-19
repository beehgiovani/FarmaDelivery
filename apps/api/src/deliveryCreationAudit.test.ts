import assert from "node:assert/strict";
import test from "node:test";
import { deliveryCreationNotes } from "./deliveryCreationAudit";

test("describes delivery creation with map-ready coordinates", () => {
  assert.match(deliveryCreationNotes({ hasCoordinates: true }), /mapa e rota/);
});

test("describes delivery creation without map coordinates", () => {
  assert.match(deliveryCreationNotes({ hasCoordinates: false }), /sem ponto no mapa/);
});

test("includes counter attendant name when delivery was checked by a registered person", () => {
  assert.match(deliveryCreationNotes({ hasCoordinates: true, attendantName: "Ana Balcao" }), /Conferida no balcao por Ana Balcao/);
});
