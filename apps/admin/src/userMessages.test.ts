import assert from "node:assert/strict";
import { test } from "node:test";
import { userFacingError } from "./userMessages";

test("keeps readable operational errors", () => {
  assert.equal(
    userFacingError(new Error("Informe uma data valida para continuar."), "Nao foi possivel concluir agora."),
    "Informe uma data valida para continuar.",
  );
});

test("hides technical backend and connection errors", () => {
  const fallback = "Nao foi possivel atualizar as informacoes agora.";

  assert.equal(userFacingError(new Error("API local falhou. Supabase REST tambem falhou."), fallback), fallback);
  assert.equal(userFacingError(new Error("connect ECONNREFUSED 127.0.0.1:3333"), fallback), fallback);
  assert.equal(userFacingError(new Error("NetworkError when attempting to fetch resource"), fallback), fallback);
  assert.equal(userFacingError(new Error("Request timeout after 10000ms"), fallback), fallback);
});

test("uses fallback for blank or non-error failures", () => {
  const fallback = "Nao foi possivel concluir agora.";

  assert.equal(userFacingError(new Error("   "), fallback), fallback);
  assert.equal(userFacingError("falha", fallback), fallback);
});
