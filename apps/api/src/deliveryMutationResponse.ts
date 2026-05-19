export type DeliveryMutationResponseInput = {
  id: string;
  publicCode: string;
  storeDailyDate?: Date | string | null;
  storeDailyNumber?: number | null;
  status: string;
  acceptedAt?: Date | string | null;
  collectedAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  canceledAt?: Date | string | null;
  courier?: {
    user: {
      name: string;
    };
  } | null;
  events: Array<{
    id: string;
    type: string;
    notes: string | null;
    createdAt: Date | string;
  }>;
};

/** Normaliza resposta de alteracao de status para admin, PWA e Android. */
export function formatDeliveryMutationResponse(delivery: DeliveryMutationResponseInput) {
  const event = delivery.events[0];
  return {
    id: delivery.id,
    publicCode: delivery.publicCode,
    storeDailyDate: formatDateOnly(delivery.storeDailyDate),
    storeDailyNumber: delivery.storeDailyNumber ?? null,
    status: delivery.status,
    courier: delivery.courier?.user.name ?? "Sem motoboy",
    acceptedAt: formatDateTime(delivery.acceptedAt),
    collectedAt: formatDateTime(delivery.collectedAt),
    deliveredAt: formatDateTime(delivery.deliveredAt),
    canceledAt: formatDateTime(delivery.canceledAt),
    event: event
      ? {
          id: event.id,
          type: event.type,
          notes: event.notes,
          createdAt: formatRequiredDateTime(event.createdAt),
        }
      : null,
  };
}

/** Mantem datas operacionais em YYYY-MM-DD para todos os clientes. */
export function formatDateOnly(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return null;
  return formatRequiredDateTime(value);
}

function formatRequiredDateTime(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
