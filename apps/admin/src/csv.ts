/** Escapa uma celula de CSV e neutraliza formulas antes de abrir em planilhas. */
export function csvCell(value: string) {
  return `"${escapeCsvFormula(value).replaceAll('"', '""')}"`;
}

/** Prefixa valores perigosos para evitar execucao de formula em Excel/Sheets. */
export function escapeCsvFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
