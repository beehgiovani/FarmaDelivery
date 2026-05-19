export type DeliveryCompletionInput = {
  deliveryId: string;
  notes?: string;
  proofId?: string;
};

/**
 * Monta o payload final da entrega sem obrigar foto.
 * A observacao e enviada limpa; o proofId so entra quando uma foto opcional foi enviada.
 */
export function deliveryCompletionInput(input: DeliveryCompletionInput): DeliveryCompletionInput {
  const payload: DeliveryCompletionInput = {
    deliveryId: input.deliveryId,
  };

  if (input.notes?.trim()) {
    payload.notes = input.notes.trim();
  }

  if (input.proofId?.trim()) {
    payload.proofId = input.proofId.trim();
  }

  return payload;
}
