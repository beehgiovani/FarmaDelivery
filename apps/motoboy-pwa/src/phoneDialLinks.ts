/** Normaliza telefone para discagem, deixando somente digitos no link tel:. */
export function phoneDialUrl(phone: string) {
  return `tel:${phone.replace(/\D/g, "")}`;
}
