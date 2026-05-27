export type GpsHealthTone = "fresh" | "recent" | "stale" | "missing";

export type GpsHealth = {
  tone: GpsHealthTone;
  label: string;
  ageMinutes: number | null;
};

export function courierGpsHealth(lastLocationAt?: string | null, now = Date.now()): GpsHealth {
  if (!lastLocationAt) {
    return { tone: "missing", label: "Sem GPS", ageMinutes: null };
  }

  const timestamp = new Date(lastLocationAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return { tone: "missing", label: "Sem GPS", ageMinutes: null };
  }

  const ageMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (ageMinutes <= 2) {
    return { tone: "fresh", label: "GPS agora", ageMinutes };
  }

  if (ageMinutes <= 10) {
    return { tone: "recent", label: `GPS ha ${ageMinutes} min`, ageMinutes };
  }

  return { tone: "stale", label: `GPS atrasado ha ${ageMinutes} min`, ageMinutes };
}

export function gpsHealthSummary<T extends { lastLocationAt?: string | null }>(couriers: T[], now = Date.now()) {
  const summary = { fresh: 0, recent: 0, stale: 0, missing: 0 };
  couriers.forEach((courier) => {
    summary[courierGpsHealth(courier.lastLocationAt, now).tone] += 1;
  });
  return summary;
}
