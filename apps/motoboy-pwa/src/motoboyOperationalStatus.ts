export type MotoboyOperationalTone = "active" | "ready" | "paused";

export type MotoboyOperationalStatus = {
  title: string;
  text: string;
  tone: MotoboyOperationalTone;
};

export function motoboyOperationalStatus(input: {
  available: boolean;
  trackingEnabled: boolean;
}): MotoboyOperationalStatus {
  if (!input.available) {
    return {
      title: "Corridas paradas",
      text: "Voce nao recebera novas entregas ate tocar em Comecar corridas.",
      tone: "paused",
    };
  }

  if (input.trackingEnabled) {
    return {
      title: "Recebendo corridas",
      text: "Novas entregas podem aparecer aqui. Sua localizacao ajuda a loja a acompanhar o atendimento.",
      tone: "active",
    };
  }

  return {
    title: "Recebendo corridas",
    text: "Novas entregas podem aparecer aqui. Ligue o GPS ao vivo para a loja acompanhar sua posicao.",
    tone: "ready",
  };
}
