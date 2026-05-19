/** Formata a data do card no fuso de Sao Paulo e usa fallback simples se vier valor inesperado. */
export function deliveryCardDateLabel(value: string): string {
  const trimmed = value.trim();
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return trimmed.slice(0, 16).replace("T", " ");
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
