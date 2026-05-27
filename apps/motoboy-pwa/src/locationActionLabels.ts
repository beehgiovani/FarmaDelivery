export function availabilityActionLabel(available: boolean): string {
  return available ? "Parar corridas" : "Comecar corridas";
}

export function availabilityShortActionLabel(): string {
  return "Corridas";
}

export function automaticLocationActionLabel(trackingEnabled: boolean): string {
  return trackingEnabled ? "Parar GPS ao vivo" : "Ligar GPS ao vivo";
}

export function sendLocationActionLabel(loading: boolean): string {
  return loading ? "Enviando..." : "Enviar minha posicao";
}
