import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./app";
import { signSessionToken } from "./auth";

test("health route responds through the Fastify app", async () => {
  const app = await createApp({ logger: false });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-request-id": "test-request-id",
      },
    });
    const payload = response.json() as {
      service: string;
      dependencies: {
        deliveryProofStorage: {
          writable: boolean;
        };
      };
    };

    assert.equal(response.headers["x-request-id"], "test-request-id");
    assert.equal(response.statusCode, 200);
    assert.equal(payload.service, "farmadelivery-api");
    assert.equal(typeof payload.dependencies.deliveryProofStorage.writable, "boolean");
  } finally {
    await app.close();
  }
});

test("protected routes reject requests without bearer token before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/deliveries",
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 401);
    assert.equal(payload.error, "UNAUTHENTICATED");
    assert.equal(payload.message, "Entre novamente para continuar.");
  } finally {
    await app.close();
  }
});

test("protected admin routes reject authenticated users with wrong role before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = signSessionToken({
      sub: "courier-user",
      role: "MOTOBOY",
      courierId: "courier-1",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const response = await app.inject({
      method: "GET",
      url: "/notifications/summary",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
  } finally {
    await app.close();
  }
});

test("store login cannot access notification monitor before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/notifications/summary",
      headers: {
        authorization: `Bearer ${storeLoginToken("44444444-4444-4444-8444-444444444444")}`,
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
  } finally {
    await app.close();
  }
});

test("store login cannot manage admin registers before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const storeId = "44444444-4444-4444-8444-444444444444";
    const headers = {
      authorization: `Bearer ${storeLoginToken(storeId)}`,
    };
    const requests = [
      app.inject({
        method: "POST",
        url: "/stores",
        headers,
        payload: {
          code: "TESTE",
          name: "Loja Teste",
          address: "Av. dos Caicaras, 1171 - Asturias",
          baseType: "COMPARTILHADA",
        },
      }),
      app.inject({
        method: "PUT",
        url: `/stores/${storeId}/weekly-hours`,
        headers,
        payload: {
          weeklyHours: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "22:00", closed: false }],
        },
      }),
      app.inject({
        method: "POST",
        url: `/stores/${storeId}/date-overrides`,
        headers,
        payload: {
          date: "2026-12-24",
          opensAt: "08:00",
          closesAt: "18:00",
          closed: false,
          reason: "Horario especial",
        },
      }),
      app.inject({
        method: "POST",
        url: "/users",
        headers,
        payload: {
          name: "Novo Acesso Loja",
          phone: "13988881234",
          password: "Farma0012870",
          role: "GERENTE",
          storeId,
        },
      }),
      app.inject({
        method: "GET",
        url: "/assignments",
        headers,
      }),
      app.inject({
        method: "POST",
        url: "/assignments/users",
        headers,
        payload: {
          userId: "77777777-7777-4777-8777-777777777777",
          storeId,
          kind: "TEMPORARIA",
        },
      }),
      app.inject({
        method: "POST",
        url: "/assignments/couriers",
        headers,
        payload: {
          courierId: "11111111-1111-4111-8111-111111111111",
          storeId,
          kind: "COBERTURA",
        },
      }),
      app.inject({
        method: "PATCH",
        url: "/assignments/users/88888888-8888-4888-8888-888888888888/end",
        headers,
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string; message: string };

      assert.equal(response.statusCode, 403);
      assert.equal(payload.error, "FORBIDDEN");
      assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
    }
  } finally {
    await app.close();
  }
});

test("store login cannot manage courier device or status before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const courierId = "11111111-1111-4111-8111-111111111111";
    const headers = {
      authorization: `Bearer ${storeLoginToken("44444444-4444-4444-8444-444444444444")}`,
    };
    const requests = [
      app.inject({
        method: "POST",
        url: "/couriers/location",
        headers,
        payload: {
          courierId,
          latitude: -24.0038253,
          longitude: -46.273904,
        },
      }),
      app.inject({
        method: "POST",
        url: "/couriers/availability",
        headers,
        payload: {
          courierId,
          available: true,
        },
      }),
      app.inject({
        method: "POST",
        url: `/couriers/${courierId}/device-token`,
        headers,
        payload: {
          deviceToken: "a".repeat(32),
          platform: "web",
        },
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string; message: string };

      assert.equal(response.statusCode, 403);
      assert.equal(payload.error, "FORBIDDEN");
      assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
    }
  } finally {
    await app.close();
  }
});

test("counter attendant reference token cannot operate deliveries before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const headers = {
      authorization: `Bearer ${counterAttendantToken("44444444-4444-4444-8444-444444444444")}`,
    };
    const requests = [
      app.inject({
        method: "GET",
        url: "/deliveries",
        headers,
      }),
      app.inject({
        method: "POST",
        url: "/deliveries/create-with-customer",
        headers,
        payload: {
          storeId: "44444444-4444-4444-8444-444444444444",
          customerName: "Cliente Teste",
          phone: "13999999999",
          street: "Av dos Caicaras",
          number: "1171",
          neighborhood: "Asturias",
          priority: "NORMAL",
        },
      }),
      app.inject({
        method: "GET",
        url: "/courier-routes",
        headers,
      }),
      app.inject({
        method: "GET",
        url: "/geocode/address?street=Av%20dos%20Caicaras&number=1171&neighborhood=Asturias",
        headers,
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string; message: string };

      assert.equal(response.statusCode, 403);
      assert.equal(payload.error, "FORBIDDEN");
      assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
    }
  } finally {
    await app.close();
  }
});

test("courier cannot reset user password before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "PATCH",
      url: "/users/22222222-2222-4222-8222-222222222222/password",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        password: "Farma0012870",
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
  } finally {
    await app.close();
  }
});

test("admin password reset validates payload before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/users/22222222-2222-4222-8222-222222222222/password",
      headers: {
        authorization: `Bearer ${adminToken()}`,
      },
      payload: {
        password: "curta",
      },
    });
    const payload = response.json() as { error: string };

    assert.equal(response.statusCode, 400);
    assert.equal(payload.error, "VALIDATION_ERROR");
  } finally {
    await app.close();
  }
});

test("login route validates payload before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        identifier: "",
        password: "",
      },
    });
    const payload = response.json() as { error: string };

    assert.equal(response.statusCode, 400);
    assert.equal(payload.error, "VALIDATION_ERROR");
  } finally {
    await app.close();
  }
});

test("courier cannot update another courier location before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "POST",
      url: "/couriers/location",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        courierId: "22222222-2222-4222-8222-222222222222",
        latitude: -24.0038253,
        longitude: -46.273904,
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Motoboy so pode atualizar a propria localizacao.");
  } finally {
    await app.close();
  }
});

test("courier cannot update another courier availability before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "POST",
      url: "/couriers/availability",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        courierId: "22222222-2222-4222-8222-222222222222",
        available: true,
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Motoboy so pode atualizar a propria disponibilidade.");
  } finally {
    await app.close();
  }
});

test("courier cannot register another courier device token before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "POST",
      url: "/couriers/22222222-2222-4222-8222-222222222222/device-token",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        deviceToken: "a".repeat(32),
        platform: "web",
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Motoboy so pode registrar o proprio dispositivo.");
  } finally {
    await app.close();
  }
});

test("courier device token route validates payload before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const courierId = "11111111-1111-4111-8111-111111111111";
    const token = courierToken(courierId);
    const response = await app.inject({
      method: "POST",
      url: `/couriers/${courierId}/device-token`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        deviceToken: "short",
        platform: "browser",
      },
    });
    const payload = response.json() as { error: string };

    assert.equal(response.statusCode, 400);
    assert.equal(payload.error, "VALIDATION_ERROR");
  } finally {
    await app.close();
  }
});

test("courier cannot accept delivery for another courier before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "POST",
      url: "/deliveries/accept",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        deliveryId: "33333333-3333-4333-8333-333333333333",
        courierId: "22222222-2222-4222-8222-222222222222",
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Motoboy so pode aceitar entregas para o proprio usuario.");
  } finally {
    await app.close();
  }
});

test("courier cannot cancel delivery before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "POST",
      url: "/deliveries/cancel",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        deliveryId: "33333333-3333-4333-8333-333333333333",
        reason: "Cliente solicitou cancelamento.",
        notifyCourier: true,
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
  } finally {
    await app.close();
  }
});

test("courier cannot create delivery before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "POST",
      url: "/deliveries",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        storeId: "44444444-4444-4444-8444-444444444444",
        customerId: "55555555-5555-4555-8555-555555555555",
        customerAddressId: "66666666-6666-4666-8666-666666666666",
        priority: "NORMAL",
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
  } finally {
    await app.close();
  }
});

test("courier cannot create delivery with customer before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "POST",
      url: "/deliveries/create-with-customer",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        storeId: "44444444-4444-4444-8444-444444444444",
        customerName: "Cliente Teste",
        phone: "13999999999",
        street: "Av dos Caicaras",
        number: "1171",
        neighborhood: "Asturias",
        priority: "NORMAL",
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
  } finally {
    await app.close();
  }
});

test("courier cannot access delivery reports before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const requests = [
      app.inject({
        method: "GET",
        url: "/reports/deliveries-summary?date=2026-05-16",
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
      app.inject({
        method: "GET",
        url: "/reports/deliveries-export?date=2026-05-16",
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string; message: string };

      assert.equal(response.statusCode, 403);
      assert.equal(payload.error, "FORBIDDEN");
      assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
    }
  } finally {
    await app.close();
  }
});

test("authenticated delivery report routes validate query before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const headers = {
      authorization: `Bearer ${adminToken()}`,
    };
    const requests = [
      app.inject({
        method: "GET",
        url: "/reports/deliveries-summary?startsAt=2026-05-17&endsAt=2026-05-16",
        headers,
      }),
      app.inject({
        method: "GET",
        url: "/reports/deliveries-export?date=2026-05-16&exportLimit=99999",
        headers,
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string };

      assert.equal(response.statusCode, 400);
      assert.equal(payload.error, "VALIDATION_ERROR");
    }
  } finally {
    await app.close();
  }
});

test("authenticated delivery event history validates delivery id before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/deliveries/entrega-invalida/events",
      headers: {
        authorization: `Bearer ${adminToken()}`,
      },
    });
    const payload = response.json() as { error: string };

    assert.equal(response.statusCode, 400);
    assert.equal(payload.error, "VALIDATION_ERROR");
  } finally {
    await app.close();
  }
});

test("authenticated courier route endpoints validate input before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const headers = {
      authorization: `Bearer ${adminToken()}`,
    };
    const requests = [
      app.inject({
        method: "GET",
        url: "/courier-routes/preview?storeId=loja-invalida",
        headers,
      }),
      app.inject({
        method: "POST",
        url: "/courier-routes/recalculate",
        headers,
        payload: {
          routeId: "rota-invalida",
          reason: "AJUSTE_MANUAL",
        },
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string };

      assert.equal(response.statusCode, 400);
      assert.equal(payload.error, "VALIDATION_ERROR");
    }
  } finally {
    await app.close();
  }
});

test("authenticated delivery creation helpers validate payload before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const headers = {
      authorization: `Bearer ${adminToken()}`,
    };
    const requests = [
      app.inject({
        method: "POST",
        url: "/customers",
        headers,
        payload: {
          name: "M",
          phone: "123",
        },
      }),
      app.inject({
        method: "POST",
        url: "/customer-addresses",
        headers,
        payload: {
          customerId: "cliente-invalido",
          street: "A",
          number: "",
        },
      }),
      app.inject({
        method: "POST",
        url: "/deliveries",
        headers,
        payload: {
          storeId: "loja-invalida",
          customerId: "cliente-invalido",
          customerAddressId: "endereco-invalido",
        },
      }),
      app.inject({
        method: "POST",
        url: "/deliveries/create-with-customer",
        headers,
        payload: {
          storeId: "loja-invalida",
          customerName: "M",
          phone: "123",
          street: "A",
          number: "",
        },
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string };

      assert.equal(response.statusCode, 400);
      assert.equal(payload.error, "VALIDATION_ERROR");
    }
  } finally {
    await app.close();
  }
});

test("authenticated delivery action endpoints validate payload before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const headers = {
      authorization: `Bearer ${adminToken()}`,
    };
    const requests = [
      app.inject({
        method: "POST",
        url: "/deliveries/collect",
        headers,
        payload: { deliveryId: "entrega-invalida" },
      }),
      app.inject({
        method: "POST",
        url: "/deliveries/start-route",
        headers,
        payload: { deliveryId: "entrega-invalida" },
      }),
      app.inject({
        method: "POST",
        url: "/deliveries/deliver",
        headers,
        payload: { deliveryId: "entrega-invalida", proofId: "comprovante-invalido" },
      }),
      app.inject({
        method: "POST",
        url: "/deliveries/problem",
        headers,
        payload: { deliveryId: "entrega-invalida", notes: "ok" },
      }),
      app.inject({
        method: "POST",
        url: "/deliveries/cancel",
        headers,
        payload: { deliveryId: "entrega-invalida", reason: "ok" },
      }),
      app.inject({
        method: "POST",
        url: "/deliveries/33333333-3333-4333-8333-333333333333/proofs",
        headers,
        payload: {
          fileName: "x",
          mimeType: "text/plain",
          contentBase64: "base64-invalido",
        },
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string };

      assert.equal(response.statusCode, 400);
      assert.equal(payload.error, "VALIDATION_ERROR");
    }
  } finally {
    await app.close();
  }
});

test("authenticated assignment endpoints validate input before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const headers = {
      authorization: `Bearer ${adminToken()}`,
    };
    const requests = [
      app.inject({
        method: "POST",
        url: "/assignments/users",
        headers,
        payload: {
          userId: "usuario-invalido",
          storeId: "loja-invalida",
          kind: "TEMPORARIA",
        },
      }),
      app.inject({
        method: "POST",
        url: "/assignments/couriers",
        headers,
        payload: {
          courierId: "motoboy-invalido",
          storeId: "loja-invalida",
          kind: "COBERTURA",
        },
      }),
      app.inject({
        method: "PATCH",
        url: "/assignments/users/alocacao-invalida/end",
        headers,
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string };

      assert.equal(response.statusCode, 400);
      assert.equal(payload.error, "VALIDATION_ERROR");
    }
  } finally {
    await app.close();
  }
});

test("courier cannot manage assignments before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const headers = {
      authorization: `Bearer ${courierToken("11111111-1111-4111-8111-111111111111")}`,
    };
    const requests = [
      app.inject({
        method: "GET",
        url: "/assignments",
        headers,
      }),
      app.inject({
        method: "POST",
        url: "/assignments/users",
        headers,
        payload: {
          userId: "77777777-7777-4777-8777-777777777777",
          storeId: "44444444-4444-4444-8444-444444444444",
          kind: "TEMPORARIA",
        },
      }),
      app.inject({
        method: "PATCH",
        url: "/assignments/users/88888888-8888-4888-8888-888888888888/end",
        headers,
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string; message: string };

      assert.equal(response.statusCode, 403);
      assert.equal(payload.error, "FORBIDDEN");
      assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
    }
  } finally {
    await app.close();
  }
});

test("courier cannot geocode addresses before external lookup", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const response = await app.inject({
      method: "GET",
      url: "/geocode/address?street=Av%20dos%20Caicaras&number=1171&neighborhood=Asturias",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const payload = response.json() as { error: string; message: string };

    assert.equal(response.statusCode, 403);
    assert.equal(payload.error, "FORBIDDEN");
    assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
  } finally {
    await app.close();
  }
});

test("courier cannot manage stores before database work", async () => {
  const app = await createApp({ logger: false });
  try {
    const token = courierToken("11111111-1111-4111-8111-111111111111");
    const headers = {
      authorization: `Bearer ${token}`,
    };
    const storeId = "44444444-4444-4444-8444-444444444444";
    const requests = [
      app.inject({
        method: "POST",
        url: "/stores",
        headers,
        payload: {
          code: "TESTE",
          name: "Loja Teste",
          address: "Av. dos Caicaras, 1171 - Asturias",
          baseType: "COMPARTILHADA",
        },
      }),
      app.inject({
        method: "PUT",
        url: `/stores/${storeId}/weekly-hours`,
        headers,
        payload: {
          weeklyHours: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "22:00", closed: false }],
        },
      }),
      app.inject({
        method: "POST",
        url: `/stores/${storeId}/date-overrides`,
        headers,
        payload: {
          date: "2026-12-24",
          opensAt: "08:00",
          closesAt: "18:00",
          closed: false,
          reason: "Horario especial",
        },
      }),
    ];

    for (const response of await Promise.all(requests)) {
      const payload = response.json() as { error: string; message: string };

      assert.equal(response.statusCode, 403);
      assert.equal(payload.error, "FORBIDDEN");
      assert.equal(payload.message, "Seu usuario nao tem permissao para esta acao.");
    }
  } finally {
    await app.close();
  }
});

function courierToken(courierId: string) {
  return signSessionToken({
    sub: "courier-user",
    role: "MOTOBOY",
    courierId,
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}

function adminToken() {
  return signSessionToken({
    sub: "admin-user",
    role: "ADMIN",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}

function storeLoginToken(storeId: string) {
  return signSessionToken({
    sub: "store-user",
    role: "GERENTE",
    storeId,
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}

function counterAttendantToken(storeId: string) {
  return signSessionToken({
    sub: "counter-attendant-user",
    role: "BALCONISTA_CAIXA",
    storeId,
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}
