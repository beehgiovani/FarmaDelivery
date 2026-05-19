import type { Delivery, DeliveryStatus, StoreUnit } from "../types";
import { StateBlock } from "./StateBlock";

type DeliveryAnalyticsProps = {
  deliveries: Delivery[];
  stores: StoreUnit[];
  scopeLabel: string;
  loading?: boolean;
  error?: string | null;
};

const statusOrder: DeliveryStatus[] = ["Aguardando", "Aceita", "Coletada", "Em rota", "Entregue", "Problema", "Cancelada"];

export function DeliveryAnalytics({ deliveries, stores, scopeLabel, loading = false, error }: DeliveryAnalyticsProps) {
  const maxByStatus = Math.max(1, ...statusOrder.map((status) => countByStatus(deliveries, status)));
  const maxByStore = Math.max(1, ...stores.map((store) => deliveries.filter((delivery) => delivery.store === store.name).length));

  return (
    <section className="analyticsPanel" aria-label="Graficos da operacao">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Graficos do dia</span>
          <h2>{scopeLabel}</h2>
        </div>
        <strong>{deliveries.length} entregas</strong>
      </div>

      {loading ? (
        <StateBlock tone="loading" title="Carregando graficos" description="Calculando resumo das entregas do periodo." />
      ) : error ? (
        <StateBlock tone="error" title="Nao foi possivel montar os graficos" description={error} />
      ) : deliveries.length === 0 ? (
        <StateBlock title="Sem dados para graficos" description="Os graficos aparecem quando houver entregas no dia/filtro selecionado." />
      ) : (
      <div className="analyticsGrid">
        <div className="chartBlock">
          <strong>Status das entregas</strong>
          <div className="barChart">
            {statusOrder.map((status) => {
              const count = countByStatus(deliveries, status);
              return (
                <div className="barRow" key={status}>
                  <span>{status}</span>
                  <div className="barTrack">
                    <i className={`barFill ${statusClass(status)}`} style={{ width: `${(count / maxByStatus) * 100}%` }} />
                  </div>
                  <b>{count}</b>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chartBlock">
          <strong>Volume por loja</strong>
          <div className="barChart">
            {stores.map((store) => {
              const count = deliveries.filter((delivery) => delivery.store === store.name).length;
              return (
                <div className="barRow" key={store.name}>
                  <span>{store.name}</span>
                  <div className="barTrack">
                    <i className="barFill storeBar" style={{ width: `${(count / maxByStore) * 100}%` }} />
                  </div>
                  <b>{count}</b>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </section>
  );
}

function countByStatus(deliveries: Delivery[], status: DeliveryStatus) {
  return deliveries.filter((delivery) => delivery.status === status).length;
}

function statusClass(status: DeliveryStatus) {
  const classes: Record<DeliveryStatus, string> = {
    Aguardando: "waitingBar",
    Aceita: "pickedBar",
    Coletada: "pickedBar",
    "Em rota": "routeBar",
    Entregue: "doneBar",
    Problema: "issueBar",
    Cancelada: "cancelBar",
  };

  return classes[status];
}
