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
      title: "Pausado",
      text: "Novas entregas nao serao direcionadas para voce ate ativar a disponibilidade.",
      tone: "paused",
    };
  }

  if (input.trackingEnabled) {
    return {
      title: "Disponivel com GPS automatico",
      text: "Voce esta recebendo entregas e sua localizacao sera enviada enquanto o PWA estiver aberto.",
      tone: "active",
    };
  }

  return {
    title: "Disponivel para corridas",
    text: "Voce pode aceitar entregas. Ligue o Auto se quiser enviar localizacao sem apertar GPS toda vez.",
    tone: "ready",
  };
}
