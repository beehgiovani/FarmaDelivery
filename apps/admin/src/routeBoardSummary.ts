/** Resume a fila aguardando aceite sem esconder entregas que ainda nao entram no mapa. */
export function buildRouteBoardSummary(input: { waiting: number; located: number }) {
  const waiting = Math.max(0, input.waiting);
  const located = Math.max(0, Math.min(input.located, waiting));
  const missing = waiting - located;

  if (missing === 0) {
    return `${waiting} aguardando aceite - ${located} no mapa`;
  }

  return `${waiting} aguardando aceite - ${located} no mapa - ${missing} sem ponto`;
}
