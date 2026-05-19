type DeliveryDisplayCodeInput = {
  publicCode: string;
  storeDailyNumber?: number | null;
};

/** Mostra o numero curto do dia quando a API ja trouxe a sequencia da loja. */
export function deliveryDailyNumberLabel(delivery: DeliveryDisplayCodeInput) {
  return delivery.storeDailyNumber ? `N. dia ${String(delivery.storeDailyNumber).padStart(3, "0")}` : null;
}

/** Mantem o codigo publico completo como fallback para entregas antigas sem sequencia diaria. */
export function deliveryPrimaryCodeLabel(delivery: DeliveryDisplayCodeInput) {
  return deliveryDailyNumberLabel(delivery) ?? delivery.publicCode;
}
