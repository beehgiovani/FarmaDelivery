import assert from "node:assert/strict";
import test from "node:test";
import {
  apiPriorityFromDeliveryPriority,
  apiDeadlineTierFromDeliveryDeadlineTier,
  apiStatusFromDeliveryStatus,
  mapDeliveryDeadlineTier,
  mapDeliveryPriority,
  mapDeliveryStatus,
  mapRawDeadlineTierLabel,
  mapRawPriorityLabel,
  mapRawDeliveryEventTypeLabel,
  mapRawRouteStatusLabel,
  mapRawRouteStopStatusLabel,
  mapRawRouteStopTypeLabel,
  mapRawStatusLabel,
  type ApiDeliveryPriority,
  type ApiDeliveryDeadlineTier,
  type ApiDeliveryStatus,
} from "./apiMappers";
import type { DeliveryDeadlineTier, DeliveryPriority, DeliveryStatus } from "./types";

test("maps API delivery statuses to UI labels", () => {
  const rows: Array<[ApiDeliveryStatus, DeliveryStatus]> = [
    ["RASCUNHO", "Aguardando"],
    ["AGUARDANDO_MOTOBOY", "Aguardando"],
    ["ACEITA_PELO_MOTOBOY", "Aceita"],
    ["COLETADA", "Coletada"],
    ["EM_ROTA", "Em rota"],
    ["ENTREGUE", "Entregue"],
    ["PROBLEMA", "Problema"],
    ["CANCELADA", "Cancelada"],
  ];

  rows.forEach(([apiStatus, uiStatus]) => {
    assert.equal(mapDeliveryStatus(apiStatus), uiStatus);
  });
});

test("maps UI delivery filters back to API status values", () => {
  const rows: Array<[DeliveryStatus, ApiDeliveryStatus]> = [
    ["Aguardando", "AGUARDANDO_MOTOBOY"],
    ["Aceita", "ACEITA_PELO_MOTOBOY"],
    ["Coletada", "COLETADA"],
    ["Em rota", "EM_ROTA"],
    ["Entregue", "ENTREGUE"],
    ["Problema", "PROBLEMA"],
    ["Cancelada", "CANCELADA"],
  ];

  rows.forEach(([uiStatus, apiStatus]) => {
    assert.equal(apiStatusFromDeliveryStatus(uiStatus), apiStatus);
  });
});

test("maps API and UI delivery priorities in both directions", () => {
  const rows: Array<[ApiDeliveryPriority, DeliveryPriority]> = [
    ["NORMAL", "Normal"],
    ["URGENTE", "Urgente"],
    ["RETORNO", "Retorno"],
  ];

  rows.forEach(([apiPriority, uiPriority]) => {
    assert.equal(mapDeliveryPriority(apiPriority), uiPriority);
    assert.equal(apiPriorityFromDeliveryPriority(uiPriority), apiPriority);
  });
});

test("maps manual delivery deadline tiers in both directions", () => {
  const rows: Array<[ApiDeliveryDeadlineTier, DeliveryDeadlineTier]> = [
    ["PERTO", "Perto"],
    ["MEDIO", "Medio"],
    ["LONGE", "Longe"],
  ];

  rows.forEach(([apiTier, uiTier]) => {
    assert.equal(mapDeliveryDeadlineTier(apiTier), uiTier);
    assert.equal(apiDeadlineTierFromDeliveryDeadlineTier(uiTier), apiTier);
  });
});

test("keeps unknown raw report labels unchanged", () => {
  assert.equal(mapRawStatusLabel("STATUS_NOVO"), "STATUS_NOVO");
  assert.equal(mapRawPriorityLabel("PRIORIDADE_NOVA"), "PRIORIDADE_NOVA");
  assert.equal(mapRawDeadlineTierLabel("PRAZO_NOVO"), "Prazo novo");
});

test("maps route labels from API values", () => {
  assert.equal(mapRawRouteStatusLabel("ABERTA"), "Aberta");
  assert.equal(mapRawRouteStatusLabel("EM_ANDAMENTO", { withPrefix: true }), "Rota em andamento");
  assert.equal(mapRawRouteStopStatusLabel("CONCLUIDA"), "Concluida");
  assert.equal(mapRawRouteStopTypeLabel("ENTREGA"), "Entrega");
});

test("maps delivery event labels from API values", () => {
  assert.equal(mapRawDeliveryEventTypeLabel("CRIADA"), "Entrega criada");
  assert.equal(mapRawDeliveryEventTypeLabel("ROTA_RECALCULADA"), "Saiu para rota");
  assert.equal(mapRawDeliveryEventTypeLabel("NOTIFICACAO_ENVIADA"), "Notificacao enviada");
});

test("formats unknown operational values without leaking raw enum style", () => {
  assert.equal(mapRawRouteStatusLabel("AGUARDANDO_APROVACAO"), "Aguardando aprovacao");
  assert.equal(mapRawRouteStopStatusLabel(""), "Status desconhecido");
  assert.equal(mapRawRouteStopTypeLabel("RETIRADA_BALCAO"), "Retirada balcao");
  assert.equal(mapRawDeliveryEventTypeLabel(""), "Evento desconhecido");
});
