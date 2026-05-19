import type { Delivery, DeliveryDeadlineTier } from "./types";

export type DeliverySlaState = "ok" | "warning" | "critical";

export const deliveryDeadlineWindowsMinutes: Record<DeliveryDeadlineTier, { warning: number; critical: number }> = {
  Perto: { warning: 60, critical: 90 },
  Medio: { warning: 90, critical: 120 },
  Longe: { warning: 120, critical: 180 },
};

/** Atalho usado por telas antigas para saber se a entrega ja passou do limite vermelho. */
export function isDeliveryOverdue(delivery: Delivery, now = Date.now()) {
  return getDeliverySlaState(delivery, now) === "critical";
}

/** Calcula o SLA visual pela criacao ou agendamento, respeitando o prazo manual escolhido na entrega. */
export function getDeliverySlaState(delivery: Delivery, now = Date.now()): DeliverySlaState {
  if (["Entregue", "Cancelada", "Problema"].includes(delivery.status)) return "ok";

  const baseTimestamp = delivery.rawScheduledFor ?? delivery.rawCreatedAt;
  const baseDate = new Date(baseTimestamp);
  if (Number.isNaN(baseDate.getTime())) return "ok";

  const deadlineWindow = deliveryDeadlineWindowsMinutes[delivery.deadlineTier] ?? deliveryDeadlineWindowsMinutes.Medio;
  const elapsedMinutes = (now - baseDate.getTime()) / 60_000;
  if (elapsedMinutes > deadlineWindow.critical) return "critical";
  if (elapsedMinutes >= deadlineWindow.warning) return "warning";
  return "ok";
}
