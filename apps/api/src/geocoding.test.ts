import assert from "node:assert/strict";
import test from "node:test";
import { buildGeocodeQueries } from "./routes/geocoding";

test("builds progressive geocode queries for Guaruja addresses", () => {
  const queries = buildGeocodeQueries({
    street: "Av dos Caicaras",
    number: "1171",
    neighborhood: "Asturias",
    city: "Guaruja",
    state: "SP",
  });

  assert.equal(queries.length, 3);
  assert.equal(queries[0], "Avenida dos Caicaras 1171 Asturias Guaruja SP Brasil");
  assert.equal(queries[1], "Avenida dos Caicaras 1171, Guaruja, SP, Brasil");
  assert.equal(queries[2], "Avenida dos Caicaras, Asturias, Guaruja, SP, Brasil");
});
