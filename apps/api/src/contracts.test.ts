import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVERY_DEADLINE_TIERS,
  DELIVERY_DEADLINE_WINDOWS_MINUTES,
  DELIVERY_PROOF_BASE64_MAX_LENGTH,
  DELIVERY_PROOF_UPLOAD_BODY_LIMIT_BYTES,
  createDeliveryWithCustomerSchema,
  createUserSchema,
  deliveryStatusTransitionSchema,
  deliveryReportQuerySchema,
  registerCourierDeviceTokenSchema,
  updateCourierAvailabilitySchema,
  updateCourierLocationSchema,
  uploadDeliveryProofSchema,
} from "./contracts";

const courierId = "11111111-1111-4111-8111-111111111111";

test("defines manual delivery deadline tiers with warning and critical limits", () => {
  assert.deepEqual([...DELIVERY_DEADLINE_TIERS], ["PERTO", "MEDIO", "LONGE"]);
  assert.deepEqual(DELIVERY_DEADLINE_WINDOWS_MINUTES, {
    PERTO: { warning: 60, critical: 90 },
    MEDIO: { warning: 90, critical: 120 },
    LONGE: { warning: 120, critical: 180 },
  });
});

test("validates manual delivery deadline tier on creation", () => {
  const parsed = createDeliveryWithCustomerSchema.parse({
    storeId: courierId,
    attendantName: "Ana Balcao",
    customerName: "Cliente Teste",
    phone: "(13) 99999-0000",
    street: "Rua Teste",
    number: "123",
    deadlineTier: "PERTO",
  });

  assert.equal(parsed.deadlineTier, "PERTO");
  assert.equal(parsed.attendantName, "Ana Balcao");
  assert.throws(() =>
    createDeliveryWithCustomerSchema.parse({
      storeId: courierId,
      customerName: "Cliente Teste",
      phone: "(13) 99999-0000",
      street: "Rua Teste",
      number: "123",
      deadlineTier: "AUTOMATICO",
    }),
  );
});

test("validates courier availability updates without requiring location", () => {
  const parsed = updateCourierAvailabilitySchema.parse({
    courierId,
    available: false,
  });

  assert.deepEqual(parsed, {
    courierId,
    available: false,
  });
});

test("keeps location availability optional so GPS does not change availability accidentally", () => {
  const parsed = updateCourierLocationSchema.parse({
    courierId,
    latitude: -23.961,
    longitude: -46.333,
  });

  assert.deepEqual(parsed, {
    courierId,
    latitude: -23.961,
    longitude: -46.333,
  });
});

test("accepts android and web courier device token platforms", () => {
  assert.equal(
    registerCourierDeviceTokenSchema.parse({
      deviceToken: "a".repeat(32),
    }).platform,
    "android",
  );

  assert.equal(
    registerCourierDeviceTokenSchema.parse({
      deviceToken: "b".repeat(32),
      platform: "web",
    }).platform,
    "web",
  );
});

test("keeps delivery proof optional on delivery completion actions", () => {
  const parsed = deliveryStatusTransitionSchema.parse({
    deliveryId: courierId,
    notes: "Recebido por Maria.",
  });

  assert.deepEqual(parsed, {
    deliveryId: courierId,
    notes: "Recebido por Maria.",
  });

  assert.throws(() =>
    deliveryStatusTransitionSchema.parse({
      deliveryId: courierId,
      proofId: "comprovante-invalido",
    }),
  );
});

test("validates delivery report date range query", () => {
  assert.deepEqual(
    deliveryReportQuerySchema.parse({
      startsAt: "2026-05-15",
      endsAt: "2026-05-16",
      status: "ENTREGUE",
      priority: "URGENTE",
      proof: "com",
      mapPoint: "sem",
      exportLimit: "10000",
    }),
    {
      startsAt: "2026-05-15",
      endsAt: "2026-05-16",
      status: "ENTREGUE",
      priority: "URGENTE",
      proof: "com",
      mapPoint: "sem",
      exportLimit: 10000,
    },
  );

  assert.throws(() =>
    deliveryReportQuerySchema.parse({
      startsAt: "2026-05-17",
      endsAt: "2026-05-16",
    }),
  );
  assert.throws(() =>
    deliveryReportQuerySchema.parse({
      exportLimit: "25000",
    }),
  );
});

test("requires a real login identifier when creating access users", () => {
  assert.deepEqual(
    createUserSchema.parse({
      name: "Acesso Loja Asturias",
      email: "asturias@loja.com",
      password: "Farma0012870",
      role: "GERENTE",
    }),
    {
      name: "Acesso Loja Asturias",
      email: "asturias@loja.com",
      password: "Farma0012870",
      role: "GERENTE",
    },
  );

  assert.throws(() =>
    createUserSchema.parse({
      name: "Acesso sem login",
      password: "Farma0012870",
      role: "GERENTE",
    }),
  );
  assert.throws(() =>
    createUserSchema.parse({
      name: "Acesso sem senha",
      email: "asturias@loja.com",
      role: "GERENTE",
    }),
  );
  assert.throws(() =>
    createUserSchema.parse({
      name: "Telefone incompleto",
      phone: "(13)",
      password: "Farma0012870",
      role: "GERENTE",
    }),
  );
});

test("allows counter attendants as operational references without login credentials", () => {
  assert.deepEqual(
    createUserSchema.parse({
      name: "Ana Balcao",
      role: "BALCONISTA_CAIXA",
    }),
    {
      name: "Ana Balcao",
      role: "BALCONISTA_CAIXA",
    },
  );

  assert.deepEqual(
    createUserSchema.parse({
      name: "Bia Caixa",
      phone: "(13) 99999-0000",
      role: "BALCONISTA_CAIXA",
    }),
    {
      name: "Bia Caixa",
      phone: "(13) 99999-0000",
      role: "BALCONISTA_CAIXA",
    },
  );
});

test("limits delivery proof base64 payload below route body limit", () => {
  assert.ok(DELIVERY_PROOF_BASE64_MAX_LENGTH < DELIVERY_PROOF_UPLOAD_BODY_LIMIT_BYTES);
  assert.equal(DELIVERY_PROOF_BASE64_MAX_LENGTH % 4, 0);

  const valid = uploadDeliveryProofSchema.parse({
    fileName: "proof.jpg",
    mimeType: "image/jpeg",
    contentBase64: "a".repeat(DELIVERY_PROOF_BASE64_MAX_LENGTH),
  });
  assert.equal(valid.contentBase64.length, DELIVERY_PROOF_BASE64_MAX_LENGTH);

  assert.throws(() =>
    uploadDeliveryProofSchema.parse({
      fileName: "proof.jpg",
      mimeType: "image/jpeg",
      contentBase64: "a".repeat(DELIVERY_PROOF_BASE64_MAX_LENGTH + 1),
    }),
  );
});

test("rejects malformed delivery proof base64 content", () => {
  const basePayload = {
    fileName: "proof.jpg",
    mimeType: "image/jpeg" as const,
  };

  assert.throws(() =>
    uploadDeliveryProofSchema.parse({
      ...basePayload,
      contentBase64: "not base64 content!!!!",
    }),
  );

  assert.throws(() =>
    uploadDeliveryProofSchema.parse({
      ...basePayload,
      contentBase64: "abcdabc",
    }),
  );
});
