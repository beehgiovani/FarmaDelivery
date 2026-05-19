import { unlink } from "node:fs/promises";
import {
  buildCourierLocationClearPatch,
  buildCustomerAddressAnonymizationPatch,
  buildCustomerAnonymizationPatch,
  buildDeliveryAnonymizationPatch,
  buildDeviceTokenDeactivationPatch,
  buildLgpdRetentionPlan,
  buildProofBinaryDeletionCommand,
  summarizeLgpdRetentionImpact,
  type CourierDeviceTokenRetentionInput,
  type CourierLocationRetentionInput,
  type CustomerRetentionInput,
  type DeliveryProofRetentionInput,
  type DeliveryRetentionInput,
  type LgpdRetentionPlan,
  type LgpdRetentionPlanInput,
} from "./lgpdRetention";
import { resolveDeliveryProofStorageFilePath } from "./deliveryProofStorage";

type PrismaLike = {
  delivery: {
    findMany(args: unknown): Promise<any[]>;
    update(args: unknown): Promise<unknown>;
  };
  deliveryProof: {
    findMany(args: unknown): Promise<any[]>;
  };
  customer: {
    findMany(args: unknown): Promise<any[]>;
    update(args: unknown): Promise<unknown>;
  };
  customerAddress: {
    findMany(args: unknown): Promise<any[]>;
    update(args: unknown): Promise<unknown>;
  };
  courier: {
    findMany(args: unknown): Promise<any[]>;
    update(args: unknown): Promise<unknown>;
  };
  courierDeviceToken: {
    findMany(args: unknown): Promise<any[]>;
    update(args: unknown): Promise<unknown>;
  };
  $transaction<T>(run: (tx: PrismaLike) => Promise<T>): Promise<T>;
};

export type LgpdRetentionRunOptions = {
  now?: string | Date;
  apply?: boolean;
  deleteProofBinary?: (command: NonNullable<ReturnType<typeof buildProofBinaryDeletionCommand>>) => Promise<void>;
};

export type LgpdRetentionRunResult = {
  mode: "dry-run" | "apply";
  planGeneratedAt: string;
  impact: ReturnType<typeof summarizeLgpdRetentionImpact>;
  applied: {
    deliveries: number;
    proofBinaries: number;
    customers: number;
    courierLocations: number;
    deviceTokens: number;
  };
  skipped: {
    proofBinariesWithoutDeleter: number;
  };
};

export async function buildLgpdRetentionPlanFromPrisma(db: PrismaLike, options: Pick<LgpdRetentionRunOptions, "now"> = {}) {
  const [deliveries, proofRows, customers, courierLocations, deviceTokens] = await Promise.all([
    db.delivery.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        deliveredAt: true,
        canceledAt: true,
      },
    }),
    db.deliveryProof.findMany({
      select: {
        id: true,
        deliveryId: true,
        createdAt: true,
        storagePath: true,
        delivery: {
          select: {
            deliveredAt: true,
          },
        },
      },
    }),
    db.customer.findMany({
      select: {
        id: true,
        deliveries: {
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            createdAt: true,
            deliveredAt: true,
            canceledAt: true,
          },
        },
      },
    }),
    db.courier.findMany({
      select: {
        id: true,
        available: true,
        lastLocationAt: true,
        currentLat: true,
        currentLng: true,
      },
    }),
    db.courierDeviceToken.findMany({
      select: {
        id: true,
        active: true,
        lastSeenAt: true,
      },
    }),
  ]);

  return buildLgpdRetentionPlan({
    now: options.now,
    deliveries,
    proofs: proofRows.map((proof) => ({
      id: proof.id,
      deliveryId: proof.deliveryId,
      createdAt: proof.createdAt,
      deliveredAt: proof.delivery?.deliveredAt ?? null,
      storagePath: proof.storagePath,
    })),
    customers: customers.map((customer) => {
      const lastDelivery = customer.deliveries[0];
      return {
        id: customer.id,
        lastDeliveryAt: lastDelivery?.deliveredAt ?? lastDelivery?.canceledAt ?? lastDelivery?.createdAt ?? null,
        hasOpenDelivery: customer.deliveries.some((delivery: { status: string }) => !["ENTREGUE", "CANCELADA"].includes(delivery.status)),
      };
    }),
    courierLocations: courierLocations.map((courier) => ({ ...courier, courierId: courier.id })),
    deviceTokens,
  } satisfies LgpdRetentionPlanInput);
}

export async function runLgpdRetentionJob(db: PrismaLike, options: LgpdRetentionRunOptions = {}): Promise<LgpdRetentionRunResult> {
  const plan = await buildLgpdRetentionPlanFromPrisma(db, options);
  return executeLgpdRetentionPlan(db, plan, options);
}

export async function executeLgpdRetentionPlan(
  db: PrismaLike,
  plan: LgpdRetentionPlan,
  options: LgpdRetentionRunOptions = {},
): Promise<LgpdRetentionRunResult> {
  const apply = options.apply === true;
  const result: LgpdRetentionRunResult = {
    mode: apply ? "apply" : "dry-run",
    planGeneratedAt: plan.generatedAt,
    impact: summarizeLgpdRetentionImpact(plan),
    applied: {
      deliveries: 0,
      proofBinaries: 0,
      customers: 0,
      courierLocations: 0,
      deviceTokens: 0,
    },
    skipped: {
      proofBinariesWithoutDeleter: 0,
    },
  };

  if (!apply) return result;

  await db.$transaction(async (tx) => {
    for (const delivery of plan.deliveriesToAnonymize) {
      await tx.delivery.update({
        where: { id: delivery.id },
        data: buildDeliveryAnonymizationPatch(delivery),
      });
      result.applied.deliveries += 1;
    }

    for (const customer of plan.customersToAnonymize) {
      await tx.customer.update({
        where: { id: customer.id },
        data: buildCustomerAnonymizationPatch(customer),
      });
      const addresses = await tx.customerAddress.findMany({
        where: { customerId: customer.id },
        select: { id: true },
      });
      for (const address of addresses) {
        await tx.customerAddress.update({
          where: { id: address.id },
          data: buildCustomerAddressAnonymizationPatch(address),
        });
      }
      result.applied.customers += 1;
    }

    for (const location of plan.courierLocationsToClear) {
      await tx.courier.update({
        where: { id: location.courierId },
        data: buildCourierLocationClearPatch(location),
      });
      result.applied.courierLocations += 1;
    }

    for (const token of plan.deviceTokensToDeactivate) {
      await tx.courierDeviceToken.update({
        where: { id: token.id },
        data: buildDeviceTokenDeactivationPatch(token),
      });
      result.applied.deviceTokens += 1;
    }

    return result;
  });

  for (const proof of plan.proofBinariesToDelete) {
    const command = buildProofBinaryDeletionCommand(proof);
    if (!command || !options.deleteProofBinary) {
      result.skipped.proofBinariesWithoutDeleter += 1;
      continue;
    }
    await options.deleteProofBinary(command);
    result.applied.proofBinaries += 1;
  }

  return result;
}

export async function deleteLocalProofBinary(command: NonNullable<ReturnType<typeof buildProofBinaryDeletionCommand>>) {
  await unlink(resolveDeliveryProofStorageFilePath(command.storagePath));
}
