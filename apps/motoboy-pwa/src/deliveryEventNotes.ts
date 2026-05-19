import type { DeliveryEvent } from "./types";

export function deliveryEventNotesText(event: Pick<DeliveryEvent, "notes">) {
  const notes = event.notes?.trim();
  return notes ? notes : null;
}
