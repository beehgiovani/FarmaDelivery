import assert from "node:assert/strict";
import test from "node:test";
import { buildLgpdRetentionPlan } from "./lgpdRetention";
import { buildLgpdRetentionPlanFromPrisma, executeLgpdRetentionPlan } from "./lgpdRetentionJob";
import { parseLgpdRetentionJobArgs } from "./lgpdRetentionJobCli";

const now = new Date("2026-05-19T12:00:00.000Z");

test("LGPD retention executor defaults to dry-run without mutating records", async () => {
  const calls: string[] = [];
  const db = fakeDb(calls);
  const plan = retentionPlan();

  const result = await executeLgpdRetentionPlan(db, plan);

  assert.equal(result.mode, "dry-run");
  assert.equal(result.impact.totalActions, 5);
  assert.deepEqual(result.applied, {
    deliveries: 0,
    proofBinaries: 0,
    customers: 0,
    courierLocations: 0,
    deviceTokens: 0,
  });
  assert.deepEqual(calls, []);
});

test("LGPD retention executor applies anonymization patches and preserves proof metadata", async () => {
  const calls: string[] = [];
  const deletedProofs: string[] = [];
  const db = fakeDb(calls);
  const plan = retentionPlan();

  const result = await executeLgpdRetentionPlan(db, plan, {
    apply: true,
    deleteProofBinary: async (command) => {
      deletedProofs.push(`${command.proofId}:${command.storagePath}`);
    },
  });

  assert.equal(result.mode, "apply");
  assert.deepEqual(result.applied, {
    deliveries: 1,
    proofBinaries: 1,
    customers: 1,
    courierLocations: 1,
    deviceTokens: 1,
  });
  assert.equal(result.skipped.proofBinariesWithoutDeleter, 0);
  assert.deepEqual(deletedProofs, ["proof-old:uploads/proof-old.jpg"]);
  assert.equal(calls.includes("delivery.update:delivery-old"), true);
  assert.equal(calls.includes("customer.update:customer-old"), true);
  assert.equal(calls.includes("customerAddress.update:address-old"), true);
  assert.equal(calls.includes("courier.update:courier-old"), true);
  assert.equal(calls.includes("courierDeviceToken.update:token-old"), true);
});

test("LGPD retention executor skips proof binary deletion when no deleter is configured", async () => {
  const calls: string[] = [];
  const db = fakeDb(calls);
  const plan = retentionPlan();

  const result = await executeLgpdRetentionPlan(db, plan, { apply: true });

  assert.equal(result.applied.proofBinaries, 0);
  assert.equal(result.skipped.proofBinariesWithoutDeleter, 1);
  assert.equal(calls.includes("delivery.update:delivery-old"), true);
});

test("LGPD retention job builds a database-backed plan without exposing source personal data", async () => {
  const plan = await buildLgpdRetentionPlanFromPrisma(fakeDb([], {
    deliveries: [
      {
        id: "delivery-old",
        status: "ENTREGUE",
        createdAt: "2024-01-01T10:00:00.000Z",
        deliveredAt: "2024-01-02T10:00:00.000Z",
        canceledAt: null,
      },
      {
        id: "delivery-open",
        status: "EM_ROTA",
        createdAt: "2026-05-18T10:00:00.000Z",
        deliveredAt: null,
        canceledAt: null,
      },
    ],
    proofs: [
      {
        id: "proof-old",
        deliveryId: "delivery-old",
        createdAt: "2025-01-01T10:00:00.000Z",
        storagePath: "uploads/proof-old.jpg",
        delivery: { deliveredAt: "2025-01-02T10:00:00.000Z" },
      },
    ],
    customers: [
      {
        id: "customer-old",
        name: "Cliente Real",
        phone: "13999999999",
        deliveries: [
          {
            status: "ENTREGUE",
            createdAt: "2024-01-01T10:00:00.000Z",
            deliveredAt: "2024-01-02T10:00:00.000Z",
            canceledAt: null,
          },
        ],
      },
    ],
    couriers: [
      {
        id: "courier-old",
        available: false,
        lastLocationAt: "2026-05-17T10:00:00.000Z",
        currentLat: -23.9,
        currentLng: -46.2,
      },
    ],
    tokens: [
      {
        id: "token-old",
        active: true,
        lastSeenAt: "2025-01-01T10:00:00.000Z",
      },
    ],
  }), { now });

  assert.deepEqual(plan.deliveriesToAnonymize.map((delivery) => delivery.id), ["delivery-old"]);
  assert.deepEqual(plan.proofBinariesToDelete.map((proof) => proof.id), ["proof-old"]);
  assert.deepEqual(plan.customersToAnonymize.map((customer) => customer.id), ["customer-old"]);
  assert.deepEqual(plan.courierLocationsToClear.map((courier) => courier.courierId), ["courier-old"]);
  assert.deepEqual(plan.deviceTokensToDeactivate.map((token) => token.id), ["token-old"]);
  assert.doesNotMatch(JSON.stringify(plan), /Cliente Real|13999999999/);
});

test("LGPD retention CLI requires explicit apply flag for destructive mode", () => {
  assert.deepEqual(parseLgpdRetentionJobArgs([]), {
    apply: false,
    deleteProofBinaries: false,
  });
  assert.deepEqual(parseLgpdRetentionJobArgs(["apply=true", "deleteProofBinaries=true"]), {
    apply: true,
    deleteProofBinaries: true,
  });
  assert.deepEqual(parseLgpdRetentionJobArgs(["--apply", "--delete-proof-binaries"]), {
    apply: true,
    deleteProofBinaries: true,
  });
  assert.throws(() => parseLgpdRetentionJobArgs(["--format=csv"]), /Argumento desconhecido/);
});

function retentionPlan() {
  return buildLgpdRetentionPlan({
    now,
    deliveries: [
      {
        id: "delivery-old",
        status: "ENTREGUE",
        createdAt: "2024-01-01T10:00:00.000Z",
        deliveredAt: "2024-01-02T10:00:00.000Z",
      },
    ],
    proofs: [
      {
        id: "proof-old",
        deliveryId: "delivery-old",
        createdAt: "2025-01-01T10:00:00.000Z",
        deliveredAt: "2025-01-02T10:00:00.000Z",
        storagePath: "uploads/proof-old.jpg",
      },
    ],
    customers: [
      {
        id: "customer-old",
        lastDeliveryAt: "2024-01-02T10:00:00.000Z",
      },
    ],
    courierLocations: [
      {
        courierId: "courier-old",
        available: false,
        currentLat: -23.9,
        currentLng: -46.2,
        lastLocationAt: "2026-05-17T10:00:00.000Z",
      },
    ],
    deviceTokens: [
      {
        id: "token-old",
        active: true,
        lastSeenAt: "2025-01-01T10:00:00.000Z",
      },
    ],
  });
}

function fakeDb(
  calls: string[],
  rows: {
    deliveries?: any[];
    proofs?: any[];
    customers?: any[];
    couriers?: any[];
    tokens?: any[];
  } = {},
) {
  return {
    delivery: {
      findMany: async () => rows.deliveries ?? [],
      update: async (args: any) => {
        calls.push(`delivery.update:${args.where.id}`);
      },
    },
    deliveryProof: {
      findMany: async () => rows.proofs ?? [],
    },
    customer: {
      findMany: async () => rows.customers ?? [],
      update: async (args: any) => {
        calls.push(`customer.update:${args.where.id}`);
      },
    },
    customerAddress: {
      findMany: async () => [{ id: "address-old" }],
      update: async (args: any) => {
        calls.push(`customerAddress.update:${args.where.id}`);
      },
    },
    courier: {
      findMany: async () => rows.couriers ?? [],
      update: async (args: any) => {
        calls.push(`courier.update:${args.where.id}`);
      },
    },
    courierDeviceToken: {
      findMany: async () => rows.tokens ?? [],
      update: async (args: any) => {
        calls.push(`courierDeviceToken.update:${args.where.id}`);
      },
    },
    $transaction: async (run: any) => run(fakeDb(calls, rows)),
  };
}
