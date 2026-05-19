import assert from "node:assert/strict";
import test from "node:test";
import {
  anonymizedLabel,
  buildCourierLocationClearPatch,
  buildCustomerAddressAnonymizationPatch,
  buildCustomerAnonymizationPatch,
  buildDeliveryAnonymizationPatch,
  buildDeviceTokenDeactivationPatch,
  buildLgpdRetentionImpactCsv,
  buildLgpdRetentionPlan,
  buildProofBinaryDeletionCommand,
  courierLocationRetentionDecision,
  customerRetentionDecision,
  deliveryProofRetentionDecision,
  deliveryRetentionDecision,
  deviceTokenRetentionDecision,
  summarizeLgpdRetentionImpact,
} from "./lgpdRetention";

const now = new Date("2026-05-16T12:00:00.000Z");

test("selects only terminal deliveries outside the LGPD retention window for anonymization", () => {
  assert.equal(
    deliveryRetentionDecision(
      {
        id: "old-delivered",
        status: "ENTREGUE",
        createdAt: "2024-04-01T10:00:00.000Z",
        deliveredAt: "2024-04-10T10:00:00.000Z",
      },
      now,
    ).action,
    "anonymize",
  );
  assert.equal(
    deliveryRetentionDecision(
      {
        id: "open",
        status: "EM_ROTA",
        createdAt: "2024-04-01T10:00:00.000Z",
      },
      now,
    ).action,
    "keep",
  );
  assert.equal(
    deliveryRetentionDecision(
      {
        id: "support",
        status: "ENTREGUE",
        createdAt: "2024-04-01T10:00:00.000Z",
        deliveredAt: "2024-04-10T10:00:00.000Z",
        hasOpenSupport: true,
      },
      now,
    ).reason,
    "delivery_has_open_support",
  );
});

test("marks proof binaries older than 180 days for deletion while preserving metadata", () => {
  assert.equal(
    deliveryProofRetentionDecision(
      {
        id: "proof-old",
        deliveryId: "delivery-1",
        deliveredAt: "2025-10-01T10:00:00.000Z",
        createdAt: "2025-10-01T10:10:00.000Z",
        storagePath: "proofs/delivery-1.jpg",
      },
      now,
    ).action,
    "delete_binary",
  );
  assert.equal(
    deliveryProofRetentionDecision(
      {
        id: "proof-without-file",
        deliveryId: "delivery-1",
        deliveredAt: "2025-10-01T10:00:00.000Z",
        createdAt: "2025-10-01T10:10:00.000Z",
      },
      now,
    ).reason,
    "proof_without_binary_path",
  );
});

test("keeps customers with open work and anonymizes inactive customers", () => {
  assert.equal(
    customerRetentionDecision(
      {
        id: "inactive-customer",
        lastDeliveryAt: "2024-04-15T10:00:00.000Z",
      },
      now,
    ).action,
    "anonymize",
  );
  assert.equal(
    customerRetentionDecision(
      {
        id: "open-delivery-customer",
        lastDeliveryAt: "2024-04-15T10:00:00.000Z",
        hasOpenDelivery: true,
      },
      now,
    ).reason,
    "customer_has_open_delivery",
  );
});

test("clears stale courier coordinates only when courier is unavailable", () => {
  assert.equal(
    courierLocationRetentionDecision(
      {
        courierId: "courier-1",
        available: false,
        lastLocationAt: "2026-05-15T09:00:00.000Z",
        currentLat: -23.9,
        currentLng: -46.2,
      },
      now,
    ).action,
    "clear_location",
  );
  assert.equal(
    courierLocationRetentionDecision(
      {
        courierId: "courier-2",
        available: true,
        lastLocationAt: "2026-05-15T09:00:00.000Z",
        currentLat: -23.9,
        currentLng: -46.2,
      },
      now,
    ).reason,
    "courier_available",
  );
});

test("deactivates stale or invalid device tokens", () => {
  assert.equal(
    deviceTokenRetentionDecision(
      {
        id: "token-old",
        active: true,
        lastSeenAt: "2026-01-01T10:00:00.000Z",
      },
      now,
    ).action,
    "deactivate",
  );
  assert.equal(
    deviceTokenRetentionDecision(
      {
        id: "token-fresh",
        active: true,
        lastSeenAt: "2026-05-15T10:00:00.000Z",
      },
      now,
    ).action,
    "keep",
  );
});

test("builds an LGPD retention dry-run plan without mutating records", () => {
  const plan = buildLgpdRetentionPlan({
    now,
    deliveries: [
      {
        id: "old-delivered",
        status: "ENTREGUE",
        createdAt: "2024-04-01T10:00:00.000Z",
        deliveredAt: "2024-04-10T10:00:00.000Z",
      },
    ],
    proofs: [
      {
        id: "proof-old",
        deliveryId: "old-delivered",
        deliveredAt: "2025-10-01T10:00:00.000Z",
        createdAt: "2025-10-01T10:10:00.000Z",
        storagePath: "proofs/old-delivered.jpg",
      },
    ],
    customers: [{ id: "customer-old", lastDeliveryAt: "2024-04-15T10:00:00.000Z" }],
    courierLocations: [
      {
        courierId: "courier-1",
        available: false,
        lastLocationAt: "2026-05-15T09:00:00.000Z",
        currentLat: -23.9,
        currentLng: -46.2,
      },
    ],
    deviceTokens: [{ id: "token-old", active: true, lastSeenAt: "2026-01-01T10:00:00.000Z" }],
  });

  assert.equal(plan.generatedAt, "2026-05-16T12:00:00.000Z");
  assert.deepEqual(plan.deliveriesToAnonymize.map((delivery) => delivery.id), ["old-delivered"]);
  assert.deepEqual(plan.proofBinariesToDelete.map((proof) => proof.id), ["proof-old"]);
  assert.deepEqual(plan.customersToAnonymize.map((customer) => customer.id), ["customer-old"]);
  assert.deepEqual(plan.courierLocationsToClear.map((location) => location.courierId), ["courier-1"]);
  assert.deepEqual(plan.deviceTokensToDeactivate.map((token) => token.id), ["token-old"]);
});

test("summarizes LGPD retention impact without exposing record details", () => {
  const plan = buildLgpdRetentionPlan({
    now,
    deliveries: [
      {
        id: "delivery-1",
        status: "ENTREGUE",
        createdAt: "2024-04-01T10:00:00.000Z",
        deliveredAt: "2024-04-10T10:00:00.000Z",
      },
      {
        id: "delivery-2",
        status: "CANCELADA",
        createdAt: "2024-04-01T10:00:00.000Z",
        canceledAt: "2024-04-10T10:00:00.000Z",
      },
    ],
    proofs: [
      {
        id: "proof-1",
        deliveryId: "delivery-1",
        deliveredAt: "2025-10-01T10:00:00.000Z",
        createdAt: "2025-10-01T10:10:00.000Z",
        storagePath: "proofs/delivery-1.jpg",
      },
    ],
  });

  const summary = summarizeLgpdRetentionImpact(plan);

  assert.equal(summary.totalActions, 3);
  assert.deepEqual(summary.byCategory, [
    { category: "comprovantes", action: "delete_binary", count: 1 },
    { category: "entregas", action: "anonymize", count: 2 },
  ]);
  assert.equal(summary.byReason.some((row) => row.reason === "delivery_terminal_outside_retention_window"), true);
});

test("builds LGPD dry-run impact csv with formula-safe context and no record ids", () => {
  const plan = buildLgpdRetentionPlan({
    now,
    deliveries: [
      {
        id: "delivery-secret-id",
        status: "ENTREGUE",
        createdAt: "2024-04-01T10:00:00.000Z",
        deliveredAt: "2024-04-10T10:00:00.000Z",
      },
    ],
    deviceTokens: [{ id: "token-secret-id", active: true, lastSeenAt: "2026-01-01T10:00:00.000Z" }],
  });

  const csv = buildLgpdRetentionImpactCsv(plan, {
    generatedAt: "2026-05-16T12:30:00.000Z",
    requestedBy: "=admin@example.com",
  });

  assert.match(csv, /"contexto_lgpd"/);
  assert.match(csv, /"modo","dry-run"/);
  assert.match(csv, /"solicitado_por","'=admin@example.com"/);
  assert.match(csv, /"total_acoes_planejadas","2"/);
  assert.match(csv, /"entregas","anonymize","1"/);
  assert.match(csv, /"tokens_notificacao","deactivate","1"/);
  assert.doesNotMatch(csv, /delivery-secret-id|token-secret-id/);
});

test("builds deterministic LGPD anonymization patches without retaining source personal data", () => {
  const customerPatch = buildCustomerAnonymizationPatch({
    id: "customer-1",
    lastDeliveryAt: "2024-04-15T10:00:00.000Z",
  });
  const addressPatch = buildCustomerAddressAnonymizationPatch({ id: "address-1" });
  const deliveryPatch = buildDeliveryAnonymizationPatch({
    id: "delivery-1",
    status: "ENTREGUE",
    createdAt: "2024-04-01T10:00:00.000Z",
    deliveredAt: "2024-04-10T10:00:00.000Z",
  });
  const tokenPatch = buildDeviceTokenDeactivationPatch({
    id: "token-1",
    active: true,
    lastSeenAt: "2026-01-01T10:00:00.000Z",
  });
  const locationPatch = buildCourierLocationClearPatch({
    courierId: "courier-1",
    available: false,
    currentLat: -23.9,
    currentLng: -46.2,
  });

  assert.match(customerPatch.name, /^cliente_anonimizado_[a-f0-9]{12}$/);
  assert.match(customerPatch.phone, /^telefone_anonimizado_[a-f0-9]{12}$/);
  assert.equal(customerPatch.name, anonymizedLabel("cliente_anonimizado", "customer-1"));
  assert.equal(addressPatch.street, anonymizedLabel("endereco_anonimizado", "address-1"));
  assert.equal(addressPatch.active, false);
  assert.equal(addressPatch.latitude, null);
  assert.equal(deliveryPatch.notes, null);
  assert.deepEqual(locationPatch, { currentLat: null, currentLng: null, lastLocationAt: null });
  assert.match(tokenPatch.token, /^token_revogado_[a-f0-9]{12}$/);
  assert.equal(tokenPatch.active, false);
});

test("builds proof binary deletion command only when a storage path exists", () => {
  assert.deepEqual(
    buildProofBinaryDeletionCommand({
      id: "proof-1",
      deliveryId: "delivery-1",
      deliveredAt: "2025-10-01T10:00:00.000Z",
      createdAt: "2025-10-01T10:10:00.000Z",
      storagePath: "proofs/delivery-1.jpg",
    }),
    {
      proofId: "proof-1",
      deliveryId: "delivery-1",
      storagePath: "proofs/delivery-1.jpg",
      preserveMetadata: true,
    },
  );
  assert.equal(
    buildProofBinaryDeletionCommand({
      id: "proof-2",
      deliveryId: "delivery-1",
      createdAt: "2025-10-01T10:10:00.000Z",
    }),
    null,
  );
});
