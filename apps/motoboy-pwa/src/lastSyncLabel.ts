const syncFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

export function lastSyncLabel(value: Date | null, now = new Date()): string {
  if (!value) return "Aguardando primeira atualizacao.";

  const diffMs = Math.max(0, now.getTime() - value.getTime());
  if (diffMs < 60_000) return "Atualizado agora.";

  return `Ultima atualizacao as ${syncFormatter.format(value)}.`;
}
