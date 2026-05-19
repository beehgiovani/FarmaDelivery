/** Descreve no historico se a entrega nasceu pronta para mapa/rota ou aguardando conferencia. */
export function deliveryCreationNotes(input: { hasCoordinates: boolean; attendantName?: string }) {
  const base = input.hasCoordinates
    ? "Entrega criada pelo painel web com endereco localizado para mapa e rota."
    : "Entrega criada pelo painel web sem ponto no mapa; endereco precisa ser conferido para aparecer na rota otimizada.";
  const attendantName = input.attendantName?.trim();
  return attendantName ? `${base} Conferida no balcao por ${attendantName}.` : base;
}
