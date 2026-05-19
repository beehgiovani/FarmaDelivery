import { BellRing, Download, RefreshCw } from "lucide-react";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { fetchNotificationSummary } from "../api";
import {
  buildNotificationEventsCsv,
  filterNotificationEvents,
  hasNotificationProblem,
  isNotificationDateRangeValid,
  type NotificationEventFilter,
} from "../notificationExport";
import type { NotificationSummary } from "../types";
import { userFacingError } from "../userMessages";
import { StateBlock } from "./StateBlock";

type NotificationSection = "summary" | "events" | "devices";

export function NotificationMonitorPanel() {
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [activeSection, setActiveSection] = useState<NotificationSection>("summary");
  const [eventLimit, setEventLimit] = useState(10);
  const [eventFilter, setEventFilter] = useState<NotificationEventFilter>("todos");
  const [storeFilter, setStoreFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState({ startsAt: "", endsAt: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSummary();
  }, [eventLimit]);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchNotificationSummary({ limit: eventLimit }));
    } catch (loadError) {
      console.error("notification summary load error", loadError);
      setError(userFacingError(loadError, "Nao foi possivel atualizar os avisos aos motoboys."));
    } finally {
      setLoading(false);
    }
  }

  const storeOptions = summary
    ? [...new Set(summary.recentEvents.map((event) => event.store).filter(Boolean))].sort((left, right) => left.localeCompare(right))
    : [];
  const typeOptions = summary
    ? [...new Set(summary.recentEvents.map((event) => event.notificationType).filter(Boolean))].sort((left, right) => left.localeCompare(right))
    : [];
  const validDateRange = isNotificationDateRangeValid(dateFilter);
  const visibleEvents = summary ? filterNotificationEvents(summary.recentEvents, eventFilter, storeFilter, dateFilter, typeFilter) : [];
  const hasActiveFilters = eventFilter !== "todos" || Boolean(storeFilter || typeFilter || dateFilter.startsAt || dateFilter.endsAt);

  function clearFilters() {
    setEventFilter("todos");
    setStoreFilter("");
    setTypeFilter("");
    setDateFilter({ startsAt: "", endsAt: "" });
  }

  return (
    <section className="notificationPanel" aria-label="Monitoramento de avisos aos motoboys">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Avisos</span>
          <h2>Avisos enviados aos motoboys</h2>
        </div>
        <div className="sectionActions">
          <button className="secondaryButton compactButton" type="button" onClick={() => void loadSummary()} disabled={loading}>
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>
      </div>

      <div className="sectionTabs" aria-label="Categorias de avisos">
        <button
          className={activeSection === "summary" ? "selected" : ""}
          type="button"
          onClick={() => setActiveSection("summary")}
        >
          Situacao dos avisos
        </button>
        <button
          className={activeSection === "events" ? "selected" : ""}
          type="button"
          onClick={() => setActiveSection("events")}
        >
          Historico de avisos
        </button>
        <button
          className={activeSection === "devices" ? "selected" : ""}
          type="button"
          onClick={() => setActiveSection("devices")}
        >
          Celulares dos motoboys
        </button>
      </div>

      {loading ? (
        <StateBlock tone="loading" title="Carregando avisos" description="Conferindo os envios recentes aos motoboys." />
      ) : error ? (
        <StateBlock tone="error" title="Nao foi possivel carregar avisos" description={error} />
      ) : summary ? (
        <>
          {activeSection === "summary" ? <NotificationSummarySection summary={summary} /> : null}
          {activeSection === "events" ? (
            <NotificationEventsSection
              clearFilters={clearFilters}
              dateFilter={dateFilter}
              eventFilter={eventFilter}
              eventLimit={eventLimit}
              hasActiveFilters={hasActiveFilters}
              setDateFilter={setDateFilter}
              setEventFilter={setEventFilter}
              setEventLimit={setEventLimit}
              setStoreFilter={setStoreFilter}
              setTypeFilter={setTypeFilter}
              storeFilter={storeFilter}
              storeOptions={storeOptions}
              summary={summary}
              typeFilter={typeFilter}
              typeOptions={typeOptions}
              validDateRange={validDateRange}
              visibleEvents={visibleEvents}
            />
          ) : null}
          {activeSection === "devices" ? <NotificationDevicesSection summary={summary} /> : null}
        </>
      ) : null}
    </section>
  );
}

function NotificationSummarySection({ summary }: { summary: NotificationSummary }) {
  return (
    <div className="notificationSummary">
      <NotificationTile label="Servico de avisos" value={summary.configured ? "Pronto" : "Pendente"} tone={summary.configured ? "ok" : "warn"} />
      <NotificationTile label="Envio automatico" value={summary.scheduledWorkerEnabled ? "Ativo" : "Desligado"} tone={summary.scheduledWorkerEnabled ? "ok" : "warn"} />
      <NotificationTile label="Celulares ativos" value={String(summary.activeTokens)} tone="ok" />
      <NotificationTile label="Celulares inativos" value={String(summary.inactiveTokens)} tone={summary.inactiveTokens > 0 ? "warn" : "ok"} />
      <NotificationTile label="Avisos enviados" value={String(summary.recentTotals.sent)} tone="ok" />
      <NotificationTile label="Avisos com falha" value={String(summary.recentTotals.failed)} tone={summary.recentTotals.failed > 0 ? "warn" : "ok"} />
    </div>
  );
}

type NotificationEventsSectionProps = {
  clearFilters: () => void;
  dateFilter: { startsAt: string; endsAt: string };
  eventFilter: NotificationEventFilter;
  eventLimit: number;
  hasActiveFilters: boolean;
  setDateFilter: Dispatch<SetStateAction<{ startsAt: string; endsAt: string }>>;
  setEventFilter: Dispatch<SetStateAction<NotificationEventFilter>>;
  setEventLimit: Dispatch<SetStateAction<number>>;
  setStoreFilter: Dispatch<SetStateAction<string>>;
  setTypeFilter: Dispatch<SetStateAction<string>>;
  storeFilter: string;
  storeOptions: string[];
  summary: NotificationSummary;
  typeFilter: string;
  typeOptions: string[];
  validDateRange: boolean;
  visibleEvents: NotificationSummary["recentEvents"];
};

function NotificationEventsSection({
  clearFilters,
  dateFilter,
  eventFilter,
  eventLimit,
  hasActiveFilters,
  setDateFilter,
  setEventFilter,
  setEventLimit,
  setStoreFilter,
  setTypeFilter,
  storeFilter,
  storeOptions,
  summary,
  typeFilter,
  typeOptions,
  validDateRange,
  visibleEvents,
}: NotificationEventsSectionProps) {
  return (
    <>
      <div className="notificationFilters" aria-label="Filtros do historico de avisos">
        <label className="compactSelect">
          <span>Registros</span>
          <select value={eventLimit} onChange={(event) => setEventLimit(Number(event.target.value))}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <label className="compactSelect">
          <span>Situacao</span>
          <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value as NotificationEventFilter)}>
            <option value="todos">Todos</option>
            <option value="problemas">Com problema</option>
          </select>
        </label>
        <label className="compactSelect">
          <span>Loja</span>
          <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
            <option value="">Todas</option>
            {storeOptions.map((store) => (
              <option key={store} value={store}>
                {store}
              </option>
            ))}
          </select>
        </label>
        <label className="compactSelect">
          <span>Tipo</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Todos</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {notificationTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="compactSelect">
          <span>De</span>
          <input
            type="date"
            value={dateFilter.startsAt}
            onChange={(event) => setDateFilter((current) => ({ ...current, startsAt: event.target.value }))}
          />
        </label>
        <label className="compactSelect">
          <span>Ate</span>
          <input
            type="date"
            value={dateFilter.endsAt}
            onChange={(event) => setDateFilter((current) => ({ ...current, endsAt: event.target.value }))}
          />
        </label>
        <button
          className="secondaryButton compactButton"
          type="button"
          disabled={!validDateRange || visibleEvents.length === 0}
          onClick={() =>
            exportNotificationEventsCsv(
              { ...summary, recentEvents: visibleEvents },
              {
                generatedAt: new Date().toISOString(),
                loadedEvents: summary.recentEvents.length,
                visibleEvents: visibleEvents.length,
                filter: eventFilter,
                store: storeFilter,
                type: typeFilter,
                startsAt: dateFilter.startsAt,
                endsAt: dateFilter.endsAt,
              },
            )
          }
        >
          <Download size={16} /> Exportar CSV
        </button>
        <button className="secondaryButton compactButton" type="button" onClick={clearFilters} disabled={!hasActiveFilters}>
          Limpar filtros
        </button>
      </div>

      {summary.recentEvents.length === 0 ? (
        <StateBlock title="Sem avisos recentes" description="Os avisos enviados aparecerao aqui quando houver entregas novas ou cancelamentos." />
      ) : !validDateRange ? (
        <StateBlock title="Periodo invalido" description="A data inicial precisa ser anterior ou igual a data final." />
      ) : visibleEvents.length === 0 ? (
        <StateBlock title="Sem registros no filtro" description="Nenhum aviso recente atende aos filtros selecionados." />
      ) : (
        <>
          <div className="notificationListHeader">
            <strong>{visibleEvents.length} avisos visiveis</strong>
            <small>{summary.recentEvents.length} avisos carregados</small>
          </div>
          <div className="notificationEvents">
            {visibleEvents.map((event) => (
              <article className={`notificationEvent ${hasNotificationProblem(event) ? "warn" : ""}`} key={event.id}>
                <span className="notificationIcon">
                  <BellRing size={16} />
                </span>
                <div>
                  <strong>{event.publicCode || event.deliveryId}</strong>
                  <small>
                    {event.store || "Loja nao informada"} - {formatDateTime(event.createdAt)}
                  </small>
                  <small>
                    Enviados {event.sent} - falhas {event.failed} - motoboys sem celular cadastrado {event.couriersWithoutTokens}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function NotificationDevicesSection({ summary }: { summary: NotificationSummary }) {
  return (
    <>
      {summary.tokenPlatforms.length > 0 ? (
        <div className="notificationPlatformList" aria-label="Celulares por plataforma">
          <strong>Celulares por tipo de aparelho</strong>
          {summary.tokenPlatforms.map((row) => (
            <div className="notificationPlatformRow" key={row.platform}>
              <span>{platformLabel(row.platform)}</span>
              <small>
                {row.active} ativos / {row.inactive} inativos
              </small>
            </div>
          ))}
        </div>
      ) : (
        <StateBlock title="Nenhum celular cadastrado" description="Os aparelhos dos motoboys aparecerao aqui depois do primeiro acesso ao app." />
      )}
      {summary.tokenDevices.length > 0 ? (
        <div className="notificationPlatformList" aria-label="Celulares por motoboy">
          <strong>Celulares por motoboy</strong>
          {summary.tokenDevices.map((device) => (
            <div className="notificationPlatformRow" key={device.id}>
              <span>
                {device.courierName} - {platformLabel(device.platform)}
              </span>
              <small>
                {device.active ? "ativo" : "inativo"} / {device.baseStoreName || "base nao informada"} / ultimo contato{" "}
                {formatDateTime(device.lastSeenAt)}
              </small>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function NotificationTile({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  return (
    <div className={`notificationTile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function notificationTypeLabel(type: string) {
  const labels: Record<string, string> = {
    NEW_DELIVERY_AVAILABLE: "Nova entrega",
    DELIVERY_CANCELED: "Cancelamento",
    NOTIFICACAO_ENVIADA: "Notificacao enviada",
  };
  return labels[type] ?? type;
}

function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    android: "Android",
    web: "PWA / Web",
    desconhecida: "Desconhecida",
  };
  return labels[platform] ?? platform;
}

function formatDateTime(value: string | null) {
  if (!value) return "sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function exportNotificationEventsCsv(
  summary: NotificationSummary,
  context: Parameters<typeof buildNotificationEventsCsv>[1],
) {
  const csv = buildNotificationEventsCsv(summary, context);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `farmadelivery-notificacoes-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
