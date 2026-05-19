import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticLocationActionLabel,
  availabilityActionLabel,
  availabilityShortActionLabel,
  sendLocationActionLabel,
} from "./locationActionLabels";

test("labels availability action by current state", () => {
  assert.equal(availabilityActionLabel(false), "Ativar corridas");
  assert.equal(availabilityActionLabel(true), "Pausar corridas");
  assert.equal(availabilityShortActionLabel(), "Corridas");
});

test("labels automatic location action clearly", () => {
  assert.equal(automaticLocationActionLabel(false), "Ligar auto");
  assert.equal(automaticLocationActionLabel(true), "Parar auto");
});

test("labels manual location action", () => {
  assert.equal(sendLocationActionLabel(false), "Enviar GPS");
  assert.equal(sendLocationActionLabel(true), "Enviando...");
});
