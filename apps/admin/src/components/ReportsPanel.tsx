import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { fetchDeliveryReportCsv } from "../api";
import {
  emptyDeliveryReportFilters,
  countReportRows,
  filterDeliveriesForReport,
  hasDeliveryReportFilters,
  type DeliveryMapPointFilter,
  type DeliveryProofFilter,
  type DeliveryReportFilters,
} from "../reportFilters";
import { buildDeliveriesCsv, deliveryReportFileName } from "../reportExport";
import { buildReportMapSummary } from "../reportMapSummary";
import {
  activeReportPeriodPreset,
  buildReportDateRangePreset,
  isReportDateRangeValid,
  reportPeriodPresets,
} from "../reportPeriod";
import type { Delivery, DeliveryPriority, DeliveryReportSummary, DeliveryStatus, ReportCountRow, StoreUnit } from "../types";
import { userFacingError } from "../userMessages";
import { StateBlock } from "./StateBlock";

const deliveryStatuses: DeliveryStatus[] = ["Aguardando", "Aceita", "Coletada", "Em rota", "Entregue", "Problema", "Cancelada"];
const deliveryPriorities: DeliveryPriority[] = ["Normal", "Urgente", "Retorno"];
const reportExportLimits = [5000, 10000, 20000, 50000];
type ReportSection = "filters" | "summary" | "distribution" | "export";

type ReportsPanelProps = {
  deliveries: Delivery[];
  stores: StoreUnit[];
  scopeLabel: string;
  dateLabel: string;
  dateRange: {
    startsAt: string;
    endsAt: string;
  };
  summary?: DeliveryReportSummary | null;
  loading?: boolean;
  error?: string | null;
  storeId?: string;
  onDateRangeChange: (dateRange: { startsAt: string; endsAt: string }) => void;
};

export function ReportsPanel({
  deliveries,
  stores,
  scopeLabel,
  dateLabel,
  dateRange,
  summary,
  loading = false,
  error,
  storeId,
  onDateRangeChange,
}: ReportsPanelProps) {
  const [activeSection, setActiveSection] = useState<ReportSection>("summary");
  const [filters, setFilters] = useState<DeliveryReportFilters>(emptyDeliveryReportFilters);
  const [exportLimit, setExportLimit] = useState(5000);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const filteredDeliveries = useMemo(
    () => filterDeliveriesForReport(deliveries, filters),
    [deliveries, filters],
  );
  const hasReportFilters = hasDeliveryReportFilters(filters);
  const localIssueCount = filteredDeliveries.filter((delivery) => delivery.status === "Problema").length;
  const localDeliveredCount = filteredDeliveries.filter((delivery) => delivery.status === "Entregue").length;
  const localActiveCourierCount = new Set(
    filteredDeliveries.map((delivery) => delivery.courier).filter((courier) => courier && courier !== "Sem motoboy"),
  ).size;
  const localStoreRows = stores.map((store) => ({
    label: store.name,
    count: filteredDeliveries.filter((delivery) => delivery.store === store.name).length,
  }));
  const localCourierRows = countReportRows(
    filteredDeliveries
      .filter((delivery) => delivery.courier && delivery.courier !== "Sem motoboy")
      .map((delivery) => delivery.courier),
  );
  const localAttendantRows = countReportRows(
    filteredDeliveries
      .map((delivery) => delivery.attendantName?.trim() ?? "")
      .filter(Boolean),
  );
  const attendantOptions = useMemo(
    () =>
      countReportRows(
        deliveries
          .map((delivery) => delivery.attendantName?.trim() ?? "")
          .filter(Boolean),
      ).map((row) => row.label),
    [deliveries],
  );
  const courierOptions = useMemo(
    () =>
      countReportRows(
        deliveries
          .map((delivery) => delivery.courier.trim())
          .filter((courier) => courier && courier !== "Sem motoboy"),
      ).map((row) => row.label),
    [deliveries],
  );
  const localStatusRows = countReportRows(filteredDeliveries.map((delivery) => delivery.status));
  const localPriorityRows = countReportRows(filteredDeliveries.map((delivery) => delivery.priority));
  const mapSummary = buildReportMapSummary(filteredDeliveries);
  const total = hasReportFilters ? filteredDeliveries.length : summary?.total ?? deliveries.length;
  const deliveredCount = hasReportFilters ? localDeliveredCount : summary?.delivered ?? localDeliveredCount;
  const deliveredWithProofCount =
    hasReportFilters
      ? filteredDeliveries.filter((delivery) => delivery.status === "Entregue" && (delivery.proofCount ?? 0) > 0).length
      : summary?.deliveredWithProof ?? filteredDeliveries.filter((delivery) => delivery.status === "Entregue" && (delivery.proofCount ?? 0) > 0).length;
  const deliveredWithoutProofCount =
    hasReportFilters
      ? filteredDeliveries.filter((delivery) => delivery.status === "Entregue" && (delivery.proofCount ?? 0) === 0).length
      : summary?.deliveredWithoutProof ??
        filteredDeliveries.filter((delivery) => delivery.status === "Entregue" && (delivery.proofCount ?? 0) === 0).length;
  const issueCount = hasReportFilters ? localIssueCount : summary?.issues ?? localIssueCount;
  const activeCourierCount = hasReportFilters ? localActiveCourierCount : summary?.activeCouriers ?? localActiveCourierCount;
  const storeRows = hasReportFilters ? localStoreRows : summary?.byStore.length ? mergeStoreRows(stores, summary.byStore) : localStoreRows;
  const courierRows = hasReportFilters ? localCourierRows : summary?.byCourier.length ? summary.byCourier : localCourierRows;
  const attendantRows = hasReportFilters ? localAttendantRows : summary?.byAttendant?.length ? summary.byAttendant : localAttendantRows;
  const statusRows = hasReportFilters ? localStatusRows : summary?.byStatus.length ? summary.byStatus : localStatusRows;
  const priorityRows = hasReportFilters ? localPriorityRows : summary?.byPriority.length ? summary.byPriority : localPriorityRows;
  const dateRangeValid = isReportDateRangeValid(dateRange);
  const activePreset = activeReportPeriodPreset(dateRange);

  return (
    <section className="reportsPanel" id="relatorios" aria-label="Relatorios da operacao">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Relatorios</span>
          <h2>{scopeLabel}</h2>
        </div>
      </div>

      <div className="sectionTabs" aria-label="Categorias do relatorio">
        <button className={activeSection === "filters" ? "selected" : ""} type="button" onClick={() => setActiveSection("filters")}>
          Filtros
        </button>
        <button className={activeSection === "summary" ? "selected" : ""} type="button" onClick={() => setActiveSection("summary")}>
          Resumo
        </button>
        <button
          className={activeSection === "distribution" ? "selected" : ""}
          type="button"
          onClick={() => setActiveSection("distribution")}
        >
          Distribuicoes
        </button>
        <button className={activeSection === "export" ? "selected" : ""} type="button" onClick={() => setActiveSection("export")}>
          Exportacao
        </button>
      </div>

      {activeSection === "filters" ? (
        <div className="reportFilters" aria-label="Periodo e filtros do relatorio">
          <div className="segmentedControl reportPresetControl" aria-label="Atalhos de periodo">
            {reportPeriodPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={activePreset === preset.value ? "selected" : ""}
                onClick={() => onDateRangeChange(buildReportDateRangePreset(preset.value))}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="compactSelect">
            <span>Inicio</span>
            <input
              type="date"
              value={dateRange.startsAt}
              onChange={(event) => onDateRangeChange({ ...dateRange, startsAt: event.target.value })}
            />
          </label>
          <label className="compactSelect">
            <span>Fim</span>
            <input
              type="date"
              value={dateRange.endsAt}
              onChange={(event) => onDateRangeChange({ ...dateRange, endsAt: event.target.value })}
            />
          </label>
          <label className="compactSelect">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as DeliveryStatus | "" })}>
              <option value="">Todos</option>
              {deliveryStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="compactSelect">
            <span>Prioridade</span>
            <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value as DeliveryPriority | "" })}>
              <option value="">Todas</option>
              {deliveryPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="compactSelect">
            <span>Comprovante</span>
            <select value={filters.proof} onChange={(event) => setFilters({ ...filters, proof: event.target.value as DeliveryProofFilter })}>
              <option value="">Todos</option>
              <option value="com">Com comprovante</option>
              <option value="sem">Sem comprovante</option>
            </select>
          </label>
          <label className="compactSelect">
            <span>Mapa</span>
            <select value={filters.mapPoint} onChange={(event) => setFilters({ ...filters, mapPoint: event.target.value as DeliveryMapPointFilter })}>
              <option value="">Todos</option>
              <option value="com">No mapa</option>
              <option value="sem">Sem ponto</option>
            </select>
          </label>
          <label className="compactSelect">
            <span>Balconista</span>
            <input
              list="report-attendants"
              value={filters.attendant}
              onChange={(event) => setFilters({ ...filters, attendant: event.target.value })}
              placeholder="Nome"
            />
            <datalist id="report-attendants">
              {attendantOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="compactSelect">
            <span>Motoboy</span>
            <input
              list="report-couriers"
              value={filters.courier}
              onChange={(event) => setFilters({ ...filters, courier: event.target.value })}
              placeholder="Nome"
            />
            <datalist id="report-couriers">
              {courierOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <button
            className="secondaryButton compactButton"
            type="button"
            disabled={!hasReportFilters}
            onClick={() => setFilters(emptyDeliveryReportFilters)}
          >
            Limpar filtros
          </button>
        </div>
      ) : null}

      {!dateRangeValid ? (
        <div className="formFeedback error reportDateFeedback">O inicio do relatorio precisa ser menor ou igual ao fim.</div>
      ) : null}
      {exportError && activeSection === "export" ? <div className="formFeedback error reportDateFeedback">{exportError}</div> : null}

      {!dateRangeValid ? (
        <StateBlock tone="error" title="Periodo invalido" description="Ajuste as datas para consolidar o relatorio." />
      ) : loading ? (
        <StateBlock tone="loading" title="Carregando relatorio" description="Consolidando entregas do periodo." />
      ) : error ? (
        <StateBlock tone="error" title="Nao foi possivel montar relatorio" description={error} />
      ) : deliveries.length === 0 ? (
        <StateBlock title="Sem entregas no periodo" description="O relatorio aparece quando houver entregas no filtro atual." />
      ) : filteredDeliveries.length === 0 ? (
        <StateBlock title="Sem entregas nos filtros" description="Nenhuma entrega do periodo atende aos filtros escolhidos." />
      ) : (
        <>
          {activeSection === "summary" || activeSection === "filters" ? (
            <div className="reportSummary" aria-label="Resumo do relatorio">
              <ReportTile label="Entregas" value={total} />
              <ReportTile label="Entregues" value={deliveredCount} />
              <ReportTile label="Com comprovante" value={deliveredWithProofCount} />
              <ReportTile label="Sem comprovante" value={deliveredWithoutProofCount} />
              <ReportTile label="No mapa" value={mapSummary.withMapPoint} />
              <ReportTile label="Sem ponto" value={mapSummary.withoutMapPoint} />
              <ReportTile label="Ocorrencias" value={issueCount} />
              <ReportTile label="Motoboys" value={activeCourierCount} />
            </div>
          ) : null}

          {activeSection === "distribution" ? (
            <div className="reportGrid">
              <ReportList title="Por loja" rows={storeRows} />
              <ReportList title="Por balconista" rows={attendantRows} emptyLabel="Nenhuma entrega com balconista informado." />
              <ReportList title="Por motoboy" rows={courierRows} emptyLabel="Nenhuma entrega aceita por motoboy." />
              <ReportList title="Por status" rows={statusRows} />
              <ReportList title="Por prioridade" rows={priorityRows} />
            </div>
          ) : null}

          {activeSection === "export" ? (
            <div className="reportExportPanel">
              <div>
                <strong>Exportar relatorio</strong>
                <p>
                  O arquivo respeita o periodo, a loja, os filtros escolhidos e mascara telefones por padrao.
                </p>
              </div>
              <label className="compactSelect">
                <span>Limite de linhas</span>
                <select value={exportLimit} onChange={(event) => setExportLimit(Number(event.target.value))}>
                  {reportExportLimits.map((limit) => (
                    <option key={limit} value={limit}>
                      {limit.toLocaleString("pt-BR")} linhas
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primaryButton"
                type="button"
                onClick={() => void handleExportReport()}
                disabled={loading || exportLoading || filteredDeliveries.length === 0}
              >
                <Download size={18} /> {exportLoading ? "Exportando..." : "Exportar CSV"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );

  async function handleExportReport() {
    setExportError("");
    setExportLoading(true);
    try {
      const result = await fetchDeliveryReportCsv({
        startsAt: dateRange.startsAt,
        endsAt: dateRange.endsAt,
        storeId,
        status: filters.status,
        priority: filters.priority,
        proof: filters.proof,
        mapPoint: filters.mapPoint,
        attendant: filters.attendant,
        courier: filters.courier,
        exportLimit,
      });
      downloadBlob(result.blob, result.fileName);
    } catch (error) {
      console.error("delivery report export error", error);
      if (hasReportFilters) {
        exportDeliveriesCsv(
          filteredDeliveries,
          dateLabel,
          scopeLabel,
          summary,
          deliveries.length,
          filters.status,
          filters.priority,
          filters.proof,
          filters.mapPoint,
          exportLimit,
          filters.attendant,
          filters.courier,
        );
        setExportError("Nao foi possivel gerar o arquivo completo. Exportei a visao filtrada carregada na tela.");
        return;
      }
      setExportError(userFacingError(error, "Nao foi possivel exportar o relatorio agora."));
    } finally {
      setExportLoading(false);
    }
  }
}

function mergeStoreRows(stores: StoreUnit[], rows: ReportCountRow[]) {
  const counts = new Map(rows.map((row) => [row.label, row.count]));
  const knownStores = stores.map((store) => ({
    label: store.name,
    count: counts.get(store.name) ?? 0,
  }));
  const unknownRows = rows.filter((row) => !stores.some((store) => store.name === row.label));
  return [...knownStores, ...unknownRows];
}

function ReportTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="reportTile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReportList({
  title,
  rows,
  emptyLabel = "Sem dados.",
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}) {
  const visibleRows = rows.filter((row) => row.count > 0);

  return (
    <div className="reportList">
      <strong>{title}</strong>
      {visibleRows.length === 0 ? (
        <small>{emptyLabel}</small>
      ) : (
        visibleRows.map((row) => (
          <div className="reportRow" key={row.label}>
            <span>{row.label}</span>
            <b>{row.count}</b>
          </div>
        ))
      )}
    </div>
  );
}

function exportDeliveriesCsv(
  deliveries: Delivery[],
  dateLabel: string,
  scopeLabel: string,
  summary?: DeliveryReportSummary | null,
  loadedDeliveries = deliveries.length,
  statusFilter = "",
  priorityFilter = "",
  proofFilter = "",
  mapPointFilter = "",
  exportLimit?: number,
  attendantFilter = "",
  courierFilter = "",
) {
  const csv = buildDeliveriesCsv(deliveries, {
    generatedAt: new Date().toISOString(),
    dateLabel,
    scopeLabel,
    loadedDeliveries,
    visibleDeliveries: deliveries.length,
    exportLimit,
    exportLimitReached: exportLimit ? deliveries.length >= exportLimit : false,
    statusFilter,
    priorityFilter,
    proofFilter,
    mapPointFilter,
    attendantFilter,
    courierFilter,
    summary: statusFilter || priorityFilter || proofFilter || mapPointFilter || attendantFilter || courierFilter ? null : summary,
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = deliveryReportFileName(scopeLabel, dateLabel);
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
