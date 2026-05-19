import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "./api";

test("creates store and returns the normalized admin store contract", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(
      JSON.stringify({
        id: "store-1",
        code: "ASTURIAS",
        name: "Asturias",
        address: "Av. Asturias, 100",
        latitude: -23.991,
        longitude: -46.256,
        baseType: "DEDICADA",
        weeklyHours: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "22:00", closed: false }],
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const created = await createStore({
      code: "ASTURIAS",
      name: "Asturias",
      address: "Av. Asturias, 100",
      baseType: "DEDICADA",
      coordinates: {
        latitude: -23.991,
        longitude: -46.256,
      },
      weeklyHours: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "22:00", closed: false }],
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://localhost:3333/stores");
    assert.equal(requests[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      code: "ASTURIAS",
      name: "Asturias",
      address: "Av. Asturias, 100",
      baseType: "DEDICADA",
      coordinates: {
        latitude: -23.991,
        longitude: -46.256,
      },
      weeklyHours: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "22:00", closed: false }],
    });
    assert.deepEqual(created, {
      id: "store-1",
      name: "Asturias",
      code: "ASTURIAS",
      address: "Av. Asturias, 100",
      queue: 0,
      color: "#275397",
      baseType: "dedicada",
      weeklyHours: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "22:00", closed: false }],
      coordinates: {
        lat: -23.991,
        lng: -46.256,
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("create store surfaces backend validation errors without browser globals", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        error: "VALIDATION_ERROR",
        message: "Informe codigo, nome e endereco da loja.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        createStore({
          code: "",
          name: "",
          address: "",
          baseType: "COMPARTILHADA",
        }),
      /Informe codigo, nome e endereco da loja\./,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
