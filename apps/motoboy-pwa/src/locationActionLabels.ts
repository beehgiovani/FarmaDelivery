export function availabilityActionLabel(available: boolean): string {
  return available ? "Pausar corridas" : "Ativar corridas";
}

export function availabilityShortActionLabel(): string {
  return "Corridas";
}

export function automaticLocationActionLabel(trackingEnabled: boolean): string {
  return trackingEnabled ? "Parar auto" : "Ligar auto";
}

export function sendLocationActionLabel(loading: boolean): string {
  return loading ? "Enviando..." : "Enviar GPS";
}
