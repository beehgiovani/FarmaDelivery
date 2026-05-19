/** Monta o resumo curto do filtro do mapa sem espalhar regra de texto pela tela. */
export function buildOperationsMapDeliverySummary(input: { total: number; located: number }) {
  const total = Math.max(0, input.total);
  const located = Math.max(0, Math.min(input.located, total));
  const missing = total - located;

  if (missing === 0) {
    return `${total} entregas no filtro - ${located} no mapa`;
  }

  return `${total} entregas no filtro - ${located} no mapa - ${missing} sem ponto`;
}
