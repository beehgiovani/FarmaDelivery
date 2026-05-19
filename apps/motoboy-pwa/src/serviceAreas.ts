export const COURIER_SERVICE_AREAS = ["ASTURIAS", "PEREQUE"] as const;

export type CourierServiceArea = (typeof COURIER_SERVICE_AREAS)[number];

export function normalizeCourierServiceArea(value: string | null): CourierServiceArea {
  return value === "PEREQUE" ? "PEREQUE" : "ASTURIAS";
}

export function courierServiceAreaLabel(serviceArea: CourierServiceArea) {
  return serviceArea === "PEREQUE" ? "Praca Pereque" : "Praca Asturias";
}

export function courierServiceAreaSummary(serviceArea: CourierServiceArea) {
  return serviceArea === "PEREQUE" ? "Somente Pereque" : "Todas as lojas, exceto Pereque";
}
