const defaultAreaCode = "13";

/** Mantem a digitacao parcial livre e so aplica mascara quando ha telefone completo. */
export function normalizeDeliveryPhoneInput(value: string) {
  if (value.trim().startsWith("+")) {
    return normalizeInternationalPhoneInput(value);
  }

  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 8) return digits;

  let fullDigits = digits;

  if (digits.length === 8) {
    if (digits.startsWith("9")) {
      return digits;
    } else if (!digits.startsWith("0") && !digits.startsWith("1") && digits[2] !== "9") {
      fullDigits = `${defaultAreaCode}${digits}`;
    }
  } else if (digits.length === 9) {
    if (digits.startsWith("9")) {
      fullDigits = `${defaultAreaCode}${digits}`;
    }
  }

  const areaCode = fullDigits.slice(0, 2);
  const localNumber = fullDigits.slice(2);

  if (!localNumber) return `(${areaCode}) `;
  if (localNumber.length <= 4) return `(${areaCode}) ${localNumber}`;
  if (localNumber.length <= 8) return `(${areaCode}) ${localNumber.slice(0, 4)}-${localNumber.slice(4)}`;
  return `(${areaCode}) ${localNumber.slice(0, 5)}-${localNumber.slice(5, 9)}`;
}

/** Valida o minimo necessario para buscar cliente e criar entrega sem depender de mascara visual. */
export function hasEnoughDeliveryPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8;
}

/** Preserva telefones internacionais com DDI, sem forcar DDD local ou formato brasileiro. */
function normalizeInternationalPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  if (!digits) return "+";

  if (digits.startsWith("55") && digits.length >= 12) {
    const areaCode = digits.slice(2, 4);
    const localNumber = digits.slice(4, 13);
    const prefixSize = localNumber.length > 8 ? 5 : 4;
    return `+55 (${areaCode}) ${localNumber.slice(0, prefixSize)}-${localNumber.slice(prefixSize)}`;
  }

  return `+${digits}`;
}
