import { Bike, Clock3, MapPinned, RefreshCw, Route } from "lucide-react";
import { mapRawRouteStatusLabel } from "../apiMappers";
import { routeStopDetail, routeStopTitle } from "../routeStopDisplay";
import type { CourierRoute } from "../types";
import { StateBlock } from "./StateBlock";

type CourierRoutesPanelProps = {
  routes: CourierRoute[];
  onRecalculate?: (route: CourierRoute) => void;
  loading?: boolean;
  error?: string | null;
  recalculatingRouteId?: string | null;
  onRetry?: () => void;
};

export function CourierRoutesPanel({
  routes,
  onRecalculate,
  loading = false,
  error,
  recalculatingRouteId,
  onRetry,
}: CourierRoutesPanelProps) {
  const activeRoutes = routes
    .filter((route) => route.status === "ABERTA" || route.status === "EM_ANDAMENTO")
    .sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <section className="courierRoutesPanel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Rotas em operacao</span>
          <h2>Motoboys com entregas aceitas</h2>
        </div>
        <span className="liveBadge">{activeRoutes.length} rotas ativas</span>
      </div>

      {loading ? (
        <StateBlock
          tone="loading"
          icon={<RefreshCw size={20} />}
          title="Carregando rotas"
          description="Buscando rotas abertas e em andamento."
        />
      ) : error ? (
        <StateBlock
          tone="error"
          title="Nao foi possivel carregar rotas"
          description={error}
          action={
            onRetry ? (
              <button className="secondaryButton" type="button" onClick={onRetry}>
                Tentar novamente
              </button>
            ) : null
          }
        />
      ) : activeRoutes.length ? (
        <div className="routeOperationalList">
          {activeRoutes.map((route) => {
            const pendingStops = route.stops.filter((stop) => stop.status === "PENDENTE").length;
            return (
              <article className="routeOperationalCard" key={route.id}>
                <div className="routeOperationalHeader">
                  <span className="avatar">
                    <Bike size={18} />
                  </span>
                  <div>
                    <strong>{route.courier.name}</strong>
                    <small>{route.courier.baseStoreName}</small>
                  </div>
                  <span className={`statusPill ${route.status === "EM_ANDAMENTO" ? "route" : "picked"}`}>
                    {mapRawRouteStatusLabel(route.status)}
                  </span>
                </div>

                <div className="routeOperationalMeta">
                  <span>
                    <Route size={15} />
                    {route.stops.length} paradas
                  </span>
                  <span>
                    <MapPinned size={15} />
                    {pendingStops} pendentes
                  </span>
                  <span>
                    <Clock3 size={15} />
                    {route.startedAt ? `Saiu ${formatDateTime(route.startedAt)}` : `Criada ${formatDateTime(route.createdAt)}`}
                  </span>
                </div>

                <button
                  className="inlineActionButton routeRecalculateButton"
                  type="button"
                  disabled={recalculatingRouteId === route.id}
                  onClick={() => onRecalculate?.(route)}
                >
                  <RefreshCw size={15} />
                  {recalculatingRouteId === route.id ? "Recalculando..." : "Recalcular rota"}
                </button>

                <div className="routeStopList">
                  {route.stops.map((stop) => (
                    <div className="routeStopItem" key={stop.id}>
                      <b>{stop.sequence}</b>
                      <div>
                        <strong>{routeStopTitle(stop)}</strong>
                        <span>{stop.address}</span>
                        <small>{routeStopDetail(stop)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <StateBlock
          icon={<Route size={20} />}
          title="Nenhuma rota ativa"
          description="Assim que um motoboy aceitar entregas, a rota aparecera aqui com paradas e status."
        />
      )}
    </section>
  );
}

function statusOrder(status: CourierRoute["status"]) {
  return status === "EM_ANDAMENTO" ? 0 : status === "ABERTA" ? 1 : 2;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
