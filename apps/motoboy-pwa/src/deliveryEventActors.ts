import type { DeliveryEvent } from "./types";

/** Mostra o responsavel pelo evento quando a API enviar esse contexto. */
export function deliveryEventActorLabel(event: Pick<DeliveryEvent, "actor">) {
  const name = event.actor?.name?.trim();
  return name ? name : null;
}
