import assert from "node:assert/strict";
import { test } from "node:test";
import { userFacingError } from "./userMessages";

test("keeps readable courier-facing errors", () => {
  assert.equal(
    userFacingError(new Error("Ative sua disponibilidade antes de aceitar corridas."), "Nao foi possivel atualizar agora."),
    "Ative sua disponibilidade antes de aceitar corridas.",
  );
});

test("hides technical backend and connection errors from courier UI", () => {
  const fallback = "Nao foi possivel atualizar agora.";

  assert.equal(userFacingError(new Error("Falha de comunicacao: 500"), fallback), fallback);
  assert.equal(userFacingError(new Error("connect ECONNREFUSED 127.0.0.1:3333"), fallback), fallback);
  assert.equal(userFacingError(new Error("NetworkError when attempting to fetch resource"), fallback), fallback);
  assert.equal(userFacingError(new Error("Request timeout after 12000ms"), fallback), fallback);
});

test("uses fallback for blank or unknown failures", () => {
  const fallback = "Nao foi possivel concluir agora.";

  assert.equal(userFacingError(new Error("   "), fallback), fallback);
  assert.equal(userFacingError("falha", fallback), fallback);
});
