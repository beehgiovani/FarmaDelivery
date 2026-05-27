import { deliveryDeadlineWindowsMinutes, getDeliverySlaState } from "./deliverySla";
import { courierGpsHealth } from "./gpsHealth";
import type { Courier, Delivery } from "./types";

export type OperationalAlertTone = "critical" | "warning" | "info";

export type OperationalAlert = {
  id: string;
  tone: OperationalAlertTone;
  title: string;
  description: string;
  deliveryId?: string;
};

export function buildOperationalAlerts(deliveries: Delivery[], now = Date.now(), couriers: Courier[] = []): OperationalAlert[] {
  return deliveries
    .flatMap((delivery) => deliveryAlerts(delivery, now, couriers))
    .sort((a, b) => alertWeight(b.tone) - alertWeight(a.tone))
    .slice(0, 12);
}

function deliveryAlerts(delivery: Delivery, now: number, couriers: Courier[]): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const elapsedMinutes = deliveryElapsedMinutes(delivery, now);
  const slaState = getDeliverySlaState(delivery, now);
  const label = delivery.publicCode ?? delivery.id;
  const courier = couriers.find((item) => normalizeName(item.name) === normalizeName(delivery.courier));

  if (delivery.status === "Problema") {
    alerts.push({
      id: `${delivery.id}:problem`,
      tone: "critical",
      title: `Problema registrado na entrega ${label}`,
      description: [delivery.customer, delivery.courier ? `motoboy ${delivery.courier}` : null, delivery.notes].filter(Boolean).join(" - "),
      deliveryId: delivery.id,
    });
  }

  if (delivery.status === "Aguardando" && elapsedMinutes >= 30) {
    alerts.push({
      id: `${delivery.id}:waiting-courier`,
      tone: elapsedMinutes >= 60 || slaState === "critical" ? "critical" : "warning",
      title: `Entrega ${label} esperando motoboy`,
      description: `${delivery.store} - ${delivery.customer} - aguardando ha ${Math.round(elapsedMinutes)} min.`,
      deliveryId: delivery.id,
    });
  }

  if (slaState === "critical" && ["Aceita", "Coletada", "Em rota"].includes(delivery.status)) {
    alerts.push({
      id: `${delivery.id}:late-with-courier`,
      tone: "critical",
      title: `Entrega ${label} atrasada com motoboy`,
      description: `${delivery.courier || "Motoboy nao informado"} - ${delivery.status} - ${Math.round(elapsedMinutes)} min desde o inicio do prazo.`,
      deliveryId: delivery.id,
    });
  }

  if (delivery.status === "Aceita" && elapsedMinutes >= 10) {
    alerts.push({
      id: `${delivery.id}:accepted-not-picked`,
      tone: elapsedMinutes >= 20 ? "critical" : "warning",
      title: `Motoboy ainda nao retirou ${label}`,
      description: `${delivery.courier || "Motoboy nao informado"} pegou a entrega ha ${Math.round(elapsedMinutes)} min.`,
      deliveryId: delivery.id,
    });
  }

  if (delivery.status === "Coletada" && elapsedMinutes >= 10) {
    alerts.push({
      id: `${delivery.id}:picked-not-started`,
      tone: elapsedMinutes >= 20 ? "critical" : "warning",
      title: `Entrega ${label} retirada, mas nao iniciada`,
      description: `${delivery.courier || "Motoboy nao informado"} retirou na loja e ainda nao comecou a entrega.`,
      deliveryId: delivery.id,
    });
  }

  if (["Aceita", "Coletada", "Em rota"].includes(delivery.status) && courier) {
    const gps = courierGpsHealth(courier.lastLocationAt, now);
    if (gps.tone === "stale" || gps.tone === "missing") {
      alerts.push({
        id: `${delivery.id}:courier-gps-${gps.tone}`,
        tone: gps.tone === "missing" ? "critical" : "warning",
        title: `GPS do motoboy sem atualizacao`,
        description: `${courier.name} - ${gps.label} - entrega ${label}.`,
        deliveryId: delivery.id,
      });
    }
  }

  if (slaState === "warning" && delivery.status !== "Aguardando") {
    const window = deliveryDeadlineWindowsMinutes[delivery.deadlineTier] ?? deliveryDeadlineWindowsMinutes.Medio;
    alerts.push({
      id: `${delivery.id}:sla-warning`,
      tone: "warning",
      title: `Entrega ${label} chegando no limite`,
      description: `${delivery.status} - ${Math.round(elapsedMinutes)} min de ${window.critical} min do prazo vermelho.`,
      deliveryId: delivery.id,
    });
  }

  if (delivery.priority === "Urgente" && delivery.status === "Aguardando" && elapsedMinutes >= 15) {
    alerts.push({
      id: `${delivery.id}:urgent-waiting`,
      tone: "warning",
      title: `Urgente ${label} ainda sem aceite`,
      description: `${delivery.store} - ${delivery.customer} - prioridade urgente aguardando ha ${Math.round(elapsedMinutes)} min.`,
      deliveryId: delivery.id,
    });
  }

  return alerts;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function deliveryElapsedMinutes(delivery: Delivery, now: number) {
  const baseTimestamp = delivery.rawScheduledFor ?? delivery.rawCreatedAt;
  const baseDate = new Date(baseTimestamp);
  if (Number.isNaN(baseDate.getTime())) return 0;
  return Math.max(0, (now - baseDate.getTime()) / 60_000);
}

function alertWeight(tone: OperationalAlertTone) {
  if (tone === "critical") return 3;
  if (tone === "warning") return 2;
  return 1;
}
