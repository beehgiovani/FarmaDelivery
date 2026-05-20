import { useEffect, useMemo, useState } from "react";
import { Clock3, Navigation, ShieldCheck, Zap } from "lucide-react";
import { fetchRoutePreview } from "../api";
import { mapRawStatusLabel } from "../apiMappers";
import type { RoutePreview, StoreUnit } from "../types";
import { userFacingError } from "../userMessages";
import { StateBlock } from "./StateBlock";

type RouteStrategyPanelProps = {
  stores: StoreUnit[];
  selectedStoreName?: string;
  isAdmin?: boolean;
};

export function RouteStrategyPanel({ stores, selectedStoreName, isAdmin = true }: RouteStrategyPanelProps) {
  const defaultStoreId = useMemo(() => {
    const selected = stores.find((store) => store.name === selectedStoreName);
    return selected?.id ?? stores[0]?.id ?? "";
  }, [selectedStoreName, stores]);
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStoreId(defaultStoreId);
  }, [defaultStoreId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchRoutePreview({ storeId: storeId || undefined })
      .then((result) => {
        if (!active) return;
        setPreview(result);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        console.error("route preview error", requestError);
        setPreview(null);
        setError(userFacingError(requestError, "Nao foi possivel montar a pre-rota agora."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [storeId]);

  return (
    <section className="routeStrategyPanel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Roteirizacao</span>
          <h2>Pre-rota operacional</h2>
        </div>
        <label className="compactSelect">
          <span>Loja</span>
          <select value={storeId} disabled={!isAdmin} onChange={(event) => setStoreId(event.target.value)}>
            {stores.map((store) => (
              <option key={store.id ?? store.name} value={store.id ?? ""}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="strategyList">
        <article>
          <Navigation size={18} />
          <strong>Rota viva</strong>
          <span>O motoboy aceita entregas e a rota e recalculada quando entra nova coleta ou entrega.</span>
        </article>
        <article>
          <Clock3 size={18} />
          <strong>Janela de horario</strong>
          <span>Criacao sempre automatica; agendamento define a partir de qual hora pode sair.</span>
        </article>
        <article>
          <ShieldCheck size={18} />
          <strong>Seguranca</strong>
          <span>Evitar retornos desnecessarios, rotas longas demais e mudancas que atrasem entregas urgentes.</span>
        </article>
        <article>
          <Zap size={18} />
          <strong>Agilidade</strong>
          <span>Priorizar menor tempo total, proximidade das lojas e agrupamento por regiao.</span>
        </article>
      </div>

      <div className="routePreview">
        <div className="routePreviewHeader">
          <strong>
            {loading
              ? "Calculando pre-rota..."
              : `${preview?.stopCount ?? 0} paradas - ${formatKm(preview?.totalDistanceKm ?? 0)}`}
          </strong>
          <span>Inicio: {preview?.start.label ?? "Sem ponto inicial"}</span>
        </div>

        {loading ? (
          <StateBlock tone="loading" title="Calculando pre-rota" description="Conferindo entregas aguardando e pontos confirmados." />
        ) : error ? (
          <StateBlock tone="error" title="Nao foi possivel montar a pre-rota" description={error} />
        ) : preview?.stops.length ? (
          <div className="previewStops">
            {preview.stops.map((stop) => (
              <article className="previewStop" key={stop.id}>
                <b>{stop.sequence}</b>
                <div>
                  <strong>{stop.customer}</strong>
                  <span>{stop.address}</span>
                  <small>
                    {stop.store} - {mapRawStatusLabel(stop.status)} - {formatKm(stop.distanceFromPreviousKm)} do ponto anterior
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <StateBlock
            title="Sem entregas roteirizaveis"
            description="Nenhuma entrega aguardando com coordenada confirmada para montar a pre-rota."
          />
        )}
      </div>
    </section>
  );
}

function formatKm(value: number) {
  return `${value.toFixed(1).replace(".", ",")} km`;
}
