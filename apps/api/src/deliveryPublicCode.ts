export const deliverySequenceTimeZone = "America/Sao_Paulo";

/** Resolve a data operacional da loja no fuso do Brasil, para a numeracao reiniciar no dia certo. */
export function resolveDeliverySequenceDate(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: deliverySequenceTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = readDatePart(parts, "year");
  const month = readDatePart(parts, "month");
  const day = readDatePart(parts, "day");
  const key = `${year}-${month}-${day}`;

  return {
    key,
    date: new Date(`${key}T00:00:00.000Z`),
  };
}

/** Monta o codigo visivel da entrega com loja, data e sequencia diaria. */
export function buildDeliveryPublicCode(storeCode: string, sequenceDateKey: string, dailyNumber: number) {
  const storePrefix = normalizeStoreCode(storeCode);
  const datePart = sequenceDateKey.replaceAll("-", "");
  const sequencePart = String(dailyNumber).padStart(3, "0");
  return `${storePrefix}-${datePart}-${sequencePart}`;
}

/** Normaliza o codigo da loja para aparecer bem em comanda, app e notificacao. */
export function normalizeStoreCode(storeCode: string) {
  const normalized = storeCode
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
  return normalized || "LOJA";
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: "year" | "month" | "day") {
  return parts.find((part) => part.type === type)?.value ?? "00";
}
