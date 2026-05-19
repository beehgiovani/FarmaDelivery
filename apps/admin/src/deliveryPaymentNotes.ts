export type DeliveryPaymentMethod = "CARTAO" | "QRCODE" | "PIX_PAGO" | "DINHEIRO" | "CONTA";

export type CashChangeMode = "SEM_TROCO" | "COM_TROCO";

const paymentLabels: Record<DeliveryPaymentMethod, string> = {
  CARTAO: "Cartao",
  QRCODE: "QR Code",
  PIX_PAGO: "Pix pago",
  DINHEIRO: "Dinheiro",
  CONTA: "Conta",
};

export function formatPaymentDetails(input: {
  amount?: string;
  paymentMethod: DeliveryPaymentMethod;
  cashChangeMode?: CashChangeMode;
  cashChangeFor?: string;
}) {
  if (input.paymentMethod !== "DINHEIRO") {
    return `Pagamento: ${paymentLabels[input.paymentMethod]}`;
  }

  if (input.cashChangeMode === "COM_TROCO") {
    const changeFor = input.cashChangeFor?.trim();
    return changeFor ? `Pagamento: Dinheiro - troco para ${changeFor}` : "Pagamento: Dinheiro - troco solicitado";
  }

  return "Pagamento: Dinheiro - sem troco";
}

export function buildDeliveryNotesWithPayment(input: {
  amount?: string;
  paymentMethod: DeliveryPaymentMethod;
  cashChangeMode?: CashChangeMode;
  cashChangeFor?: string;
  notes?: string;
}) {
  const amount = input.amount?.trim();
  return [amount ? `Valor: ${amount}` : undefined, formatPaymentDetails(input), input.notes?.trim()].filter(Boolean).join("\n");
}

export function formatBrazilianMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(cents / 100)
    .replace(/\u00a0/g, " ");
}
