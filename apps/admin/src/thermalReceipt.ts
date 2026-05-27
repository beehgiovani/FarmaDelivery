import type { Delivery } from "./types";

type ThermalReceiptOptions = {
  printedAt?: Date;
};

const thermalReceiptLayout = {
  pageWidthMm: 80,
  bodyWidthMm: 72,
  pageMarginMm: 4,
  labelWidthMm: 21,
  fontSizePx: 11,
  titleSizePx: 15,
  subtitleSizePx: 12,
  addressSizePx: 12,
  footerSizePx: 10,
};

/** Monta o HTML da comanda termica usando somente dados reais da entrega. */
export function buildThermalReceiptHtml(delivery: Delivery, options: ThermalReceiptOptions = {}) {
  const printedAt = options.printedAt ?? new Date();
  const layout = thermalReceiptLayout;
  const deliveryCode = delivery.publicCode ?? delivery.id;
  const identityRows = [
    ["Entrega", deliveryCode],
    ...(delivery.storeDailyNumber ? [["N. do dia", formatStoreDailyNumber(delivery.storeDailyNumber)]] : []),
    ["Loja", delivery.store],
    ["Criada", delivery.createdAt],
  ];
  const customerRows = [
    ["Cliente", delivery.customer],
    ["Telefone", delivery.phone],
    ["Endereco", delivery.address],
  ];
  const operationRows = [
    ["Agendado", delivery.scheduledFor],
    ["Status", delivery.status],
    ["Prioridade", delivery.priority],
    ["Prazo", delivery.deadlineTier],
    ...(delivery.notes?.trim() ? [["Pagamento/obs.", delivery.notes.trim()]] : []),
    ...(delivery.dispatchedAt ? [["Aceite", delivery.dispatchedAt]] : []),
    ...(delivery.collectedAt ? [["Coleta", delivery.collectedAt]] : []),
    ...(delivery.deliveredAt ? [["Entrega", delivery.deliveredAt]] : []),
  ];

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Comanda ${escapeHtml(deliveryCode)}</title>
    <style>
      @page {
        size: ${layout.pageWidthMm}mm auto;
        margin: ${layout.pageMarginMm}mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        width: ${layout.bodyWidthMm}mm;
        margin: 0;
        color: #000;
        background: #fff;
        font-family: Arial, "Helvetica Neue", sans-serif;
        font-size: ${layout.fontSizePx}px;
        line-height: 1.25;
      }

      .receipt {
        width: 100%;
        padding-bottom: 6mm;
      }

      .center {
        text-align: center;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        font-size: ${layout.titleSizePx}px;
        font-weight: 900;
        text-transform: uppercase;
      }

      h2 {
        margin-top: 2px;
        font-size: ${layout.subtitleSizePx}px;
      }

      .line {
        border-top: 1px dashed #000;
        margin: 7px 0;
      }

      .receiptBlock {
        border: 1px solid #000;
        padding: 2mm;
        margin: 2mm 0;
        break-inside: avoid;
      }

      .row {
        display: grid;
        grid-template-columns: ${layout.labelWidthMm}mm 1fr;
        gap: 2mm;
        margin: 2px 0;
        break-inside: avoid;
      }

      .row.stacked {
        grid-template-columns: 1fr;
        gap: 1px;
        margin-top: 4px;
      }

      .label {
        font-weight: 800;
      }

      .value {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      .address {
        font-size: ${layout.addressSizePx}px;
        font-weight: 800;
      }

      .footer {
        margin-top: 10px;
        font-size: ${layout.footerSizePx}px;
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <header class="center">
        <h1>Drogaria Santo Antonio</h1>
        <h2>Drogaria Santo Antonio - Comanda de entrega</h2>
        <p>Impresso em ${escapeHtml(formatReceiptDate(printedAt))}</p>
      </header>
      <div class="line"></div>
      ${receiptBlock(identityRows)}
      ${receiptBlock(customerRows)}
      ${receiptBlock(operationRows)}
      <div class="line"></div>
      <p><strong>Produtos:</strong> conferir na comanda fiscal/manual da loja.</p>
      <p><strong>Recebedor:</strong> __________________________</p>
      <p><strong>Assinatura:</strong> _________________________</p>
      <p class="footer center">Comanda operacional. Nao substitui documento fiscal.</p>
    </main>
    <script>
      window.addEventListener("load", function () {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`;
}

/** Abre a janela de impressao do navegador para qualquer termica instalada no Windows/rede. */
export function printThermalReceipt(delivery: Delivery, options: ThermalReceiptOptions = {}) {
  const printWindow = window.open("", `farmadelivery-print-${delivery.publicCode ?? delivery.id}`, "width=420,height=640");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(buildThermalReceiptHtml(delivery, options));
  printWindow.document.close();
  return true;
}

/** Monta uma linha label/valor da comanda, destacando endereco por ser o dado mais importante. */
function receiptRow(label: string, value: string, important = false) {
  const stacked = label === "Pagamento/obs.";
  return `<div class="row${important ? " address" : ""}${stacked ? " stacked" : ""}">
    <span class="label">${escapeHtml(label)}</span>
    <span class="value">${escapeHtml(value || "-")}</span>
  </div>`;
}

function receiptBlock(rows: string[][]) {
  return `<section class="receiptBlock">${rows.map(([label, value]) => receiptRow(label, value, label === "Endereco")).join("")}</section>`;
}

/** Formata o numero sequencial do dia no mesmo padrao visual usado no codigo publico. */
function formatStoreDailyNumber(value: number) {
  return String(value).padStart(3, "0");
}

/** Formata a data de impressao em pt-BR sem depender do layout do painel. */
function formatReceiptDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Escapa valores da entrega antes de inserir no HTML da janela de impressao. */
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
