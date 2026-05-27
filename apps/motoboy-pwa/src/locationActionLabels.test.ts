import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticLocationActionLabel,
  availabilityActionLabel,
  availabilityShortActionLabel,
  sendLocationActionLabel,
} from "./locationActionLabels";

test("labels availability action by current state", () => {
  assert.equal(availabilityActionLabel(false), "Comecar corridas");
  assert.equal(availabilityActionLabel(true), "Parar corridas");
  assert.equal(availabilityShortActionLabel(), "Corridas");
});

test("labels automatic location action clearly", () => {
  assert.equal(automaticLocationActionLabel(false), "Ligar GPS ao vivo");
  assert.equal(automaticLocationActionLabel(true), "Parar GPS ao vivo");
});

test("labels manual location action", () => {
  assert.equal(sendLocationActionLabel(false), "Enviar minha posicao");
  assert.equal(sendLocationActionLabel(true), "Enviando...");
});
