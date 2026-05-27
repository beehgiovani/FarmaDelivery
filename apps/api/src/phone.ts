/** Normaliza telefone para persistencia e comparacao, mantendo apenas digitos. */
export function normalizePhoneForStorage(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || undefined;
}

/** Monta candidatos para busca aceitando legado com mascara e o formato novo sem mascara. */
export function phoneLookupCandidates(value: string | null | undefined) {
  const raw = value?.trim();
  const normalized = normalizePhoneForStorage(raw);
  return Array.from(
    new Set([raw, normalized, ...legacyBrazilianPhoneMasks(normalized)].filter((item): item is string => Boolean(item))),
  );
}

/** Diferencia email de identificador telefonico no login. */
export function isPhoneIdentifier(value: string) {
  return !value.includes("@") && /\d/.test(value);
}

function legacyBrazilianPhoneMasks(digits: string | undefined) {
  if (!digits) return [];

  const localDigits = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  const masks: string[] = [];

  if (localDigits.length === 11) {
    masks.push(`(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`);
  }

  if (localDigits.length === 10) {
    masks.push(`(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`);
  }

  if (localDigits !== digits) {
    masks.push(localDigits);
  }

  return masks;
}
