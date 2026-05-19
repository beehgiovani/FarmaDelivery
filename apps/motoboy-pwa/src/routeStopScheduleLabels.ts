export function routeStopScheduleLabel(earliestAt: string | null | undefined): string | null {
  if (!earliestAt) return null;
  const trimmed = earliestAt.trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return `A partir de ${trimmed.slice(0, 16).replace("T", " ")}`;
  }

  return `A partir de ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date)}`;
}
