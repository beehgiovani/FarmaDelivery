import type { Delivery } from "./types";

const AVAILABLE_DELIVERY_STATUS: Delivery["status"] = "AGUARDANDO_MOTOBOY";
const ACTIVE_DELIVERY_STATUSES = new Set<Delivery["status"]>([
  "ACEITA_PELO_MOTOBOY",
  "COLETADA",
  "EM_ROTA",
  "PROBLEMA",
]);

export type DeliverySections = {
  active: Delivery[];
  available: Delivery[];
};

/** Separa a fila do motoboy entre entregas disponiveis e entregas que ja estao sob atendimento. */
export function deliverySections(deliveries: Delivery[]): DeliverySections {
  return {
    active: deliveries.filter((delivery) => ACTIVE_DELIVERY_STATUSES.has(delivery.status)),
    available: deliveries.filter((delivery) => delivery.status === AVAILABLE_DELIVERY_STATUS),
  };
}
