import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, LoaderCircle, Printer } from "lucide-react";
import { formatAttendantReference } from "../attendantReferences";
import type { Delivery, DeliveryStatus, TeamUser } from "../types";
import { deliveryDeadlineWindowsMinutes, getDeliverySlaState } from "../deliverySla";
import { printThermalReceipt } from "../thermalReceipt";
import { StateBlock } from "./StateBlock";

type DeliveryTableProps = {
  deliveries: Delivery[];
  couriers?: TeamUser[];
  onCancel?: (delivery: Delivery) => void;
  onAccept?: (delivery: Delivery, courierId: string) => void;
  onCollect?: (delivery: Delivery) => void;
  onStartRoute?: (delivery: Delivery) => void;
  onComplete?: (delivery: Delivery) => void;
  onProblem?: (delivery: Delivery) => void;
  onShowHistory?: (delivery: Delivery) => void;
  loading?: boolean;
  error?: string | null;
  actionDeliveryId?: string | null;
  highlightedDeliveryIds?: ReadonlySet<string>;
  onRetry?: () => void;
};

const statusClass: Record<DeliveryStatus, string> = {
  Aguardando: "waiting",
  Aceita: "picked",
  Coletada: "picked",
  "Em rota": "route",
  Entregue: "done",
  Problema: "issue",
  Cancelada: "issue",
};

export function DeliveryTable({
  deliveries,
  couriers = [],
  onCancel,
  onAccept,
  onCollect,
  onStartRoute,
  onComplete,
  onProblem,
  onShowHistory,
  loading = false,
  error,
  actionDeliveryId,
  highlightedDeliveryIds,
  onRetry,
}: DeliveryTableProps) {
  const [selectedCouriers, setSelectedCouriers] = useState<Record<string, string>>({});
  const courierOptions = useMemo(() => couriers.filter((user) => user.role === "MOTOBOY" && user.courier), [couriers]);

  return (
    <div className="deliveryTable">
      {loading ? (
        <StateBlock
          tone="loading"
          icon={<LoaderCircle size={20} />}
          title="Carregando entregas"
          description="Atualizando a fila de entregas."
        />
      ) : error ? (
        <StateBlock
          tone="error"
          icon={<AlertTriangle size={20} />}
          title="Nao foi possivel carregar entregas"
          description={error}
          action={
            onRetry ? (
              <button className="secondaryButton" type="button" onClick={onRetry}>
                Tentar novamente
              </button>
            ) : null
          }
        />
      ) : deliveries.length === 0 ? (
        <StateBlock
          icon={<ClipboardList size={20} />}
          title="Nenhuma entrega no filtro atual"
          description="Quando uma loja lancar uma entrega, ela aparecera aqui com horario de criacao e status."
        />
      ) : (
        deliveries.map((delivery) => {
          const slaState = getDeliverySlaState(delivery);
          const deadlineWindow = deliveryDeadlineWindowsMinutes[delivery.deadlineTier];
          const recentlyChanged = highlightedDeliveryIds?.has(delivery.id) ?? false;
          return (
          <article
            className={`deliveryRow${slaState === "warning" ? " slaWarning" : ""}${slaState === "critical" ? " overdue" : ""}${recentlyChanged ? " liveChanged" : ""}`}
            key={delivery.id}
          >
            <div>
              <strong>{delivery.publicCode ?? delivery.id}</strong>
              {delivery.storeDailyNumber ? <span className="dailyNumberPill">N. dia {formatStoreDailyNumber(delivery.storeDailyNumber)}</span> : null}
              <span>{delivery.store}</span>
            </div>
            <div>
              <strong>{delivery.customer}</strong>
              <span>{delivery.phone}</span>
            </div>
            <div className="addressCell">
              {delivery.address}
              <small>Agendado: {delivery.scheduledFor}</small>
              {delivery.notes?.trim() ? <small className="paymentNotesLine">{delivery.notes.trim()}</small> : null}
            </div>
            <div className="statusStack">
              <span className={`statusPill ${statusClass[delivery.status]}`}>{delivery.status}</span>
              <span className="deadlinePill">
                {delivery.deadlineTier} {deadlineWindow.warning}-{deadlineWindow.critical} min
              </span>
              {slaState === "warning" ? <span className="slaPill warning">Prazo no limite</span> : null}
              {slaState === "critical" ? <span className="slaPill critical">Prazo estourado</span> : null}
              {delivery.proofCount ? <span className="proofPill">Comprovante</span> : null}
              {!delivery.coordinates ? <span className="mapMissingPill">Sem ponto no mapa</span> : null}
              {recentlyChanged ? <span className="liveUpdatePill">Atualizado agora</span> : null}
            </div>
            <div>
              <strong>{delivery.courier}</strong>
              <span>Balcao: {formatAttendantReference(delivery.attendantName) || "Nao informado"}</span>
              <span>Criou {delivery.createdAt}</span>
              {delivery.dispatchedAt ? <span>Aceite {delivery.dispatchedAt}</span> : <span>Sem aceite</span>}
              {delivery.collectedAt ? <span>Coleta {delivery.collectedAt}</span> : null}
              {delivery.deliveredAt ? <span>Ent. {delivery.deliveredAt}</span> : null}
              <div className="deliveryActions">
                {delivery.status === "Aguardando" && onAccept && courierOptions.length > 0 ? (
                  <>
                    <select
                      value={selectedCouriers[delivery.id] ?? courierOptions[0]?.courier?.id ?? ""}
                      onChange={(event) =>
                        setSelectedCouriers((current) => ({
                          ...current,
                          [delivery.id]: event.target.value,
                        }))
                      }
                    >
                      {courierOptions.map((courier) => (
                        <option key={courier.courier!.id} value={courier.courier!.id}>
                          {courier.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="inlineActionButton"
                      type="button"
                      disabled={actionDeliveryId === delivery.id}
                      onClick={() => onAccept(delivery, selectedCouriers[delivery.id] ?? courierOptions[0]!.courier!.id)}
                    >
                      {actionDeliveryId === delivery.id ? "Aguarde..." : "Aceitar"}
                    </button>
                  </>
                ) : null}
                {delivery.status === "Aceita" && onCollect ? (
                  <button className="inlineActionButton" type="button" disabled={actionDeliveryId === delivery.id} onClick={() => onCollect(delivery)}>
                    {actionDeliveryId === delivery.id ? "Aguarde..." : "Coletar"}
                  </button>
                ) : null}
                {delivery.status === "Coletada" && onStartRoute ? (
                  <button className="inlineActionButton" type="button" disabled={actionDeliveryId === delivery.id} onClick={() => onStartRoute(delivery)}>
                    {actionDeliveryId === delivery.id ? "Aguarde..." : "Sair rota"}
                  </button>
                ) : null}
                {delivery.status === "Em rota" && onComplete ? (
                  <button className="inlineActionButton" type="button" disabled={actionDeliveryId === delivery.id} onClick={() => onComplete(delivery)}>
                    {actionDeliveryId === delivery.id ? "Aguarde..." : "Entregar"}
                  </button>
                ) : null}
                {!["Cancelada", "Entregue", "Problema"].includes(delivery.status) && onProblem ? (
                  <button className="inlineWarningButton" type="button" disabled={actionDeliveryId === delivery.id} onClick={() => onProblem(delivery)}>
                    Problema
                  </button>
                ) : null}
              </div>
              {delivery.status !== "Cancelada" && onCancel ? (
                <button className="inlineDangerButton" type="button" disabled={actionDeliveryId === delivery.id} onClick={() => onCancel(delivery)}>
                  Cancelar
                </button>
              ) : null}
              {onShowHistory ? (
                <button className="inlineHistoryButton" type="button" onClick={() => onShowHistory(delivery)}>
                  Historico
                </button>
              ) : null}
              <button className="inlineHistoryButton" type="button" onClick={() => printThermalReceipt(delivery)}>
                <Printer size={14} /> Imprimir
              </button>
            </div>
          </article>
          );
        })
      )}
    </div>
  );
}

/** Exibe o numero diario com zero a esquerda para bater com a comanda impressa. */
function formatStoreDailyNumber(value: number) {
  return String(value).padStart(3, "0");
}
