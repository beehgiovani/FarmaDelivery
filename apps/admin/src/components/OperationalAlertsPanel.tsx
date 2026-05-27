import { AlertTriangle, Clock3, Info } from "lucide-react";
import type { OperationalAlert } from "../operationalAlerts";

type OperationalAlertsPanelProps = {
  alerts: OperationalAlert[];
  onSelectDelivery?: (deliveryId: string) => void;
};

export function OperationalAlertsPanel({ alerts, onSelectDelivery }: OperationalAlertsPanelProps) {
  return (
    <section className="operationalAlertsPanel" aria-label="Alertas operacionais">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Controle operacional</span>
          <h2>Alertas que precisam de atencao</h2>
        </div>
        <span className="alertCount">{alerts.length}</span>
      </div>

      {alerts.length === 0 ? (
        <div className="stateBlock">
          <strong>Nenhum alerta critico agora</strong>
          <p>Entregas recentes, atrasos e problemas registrados aparecem aqui conforme a operacao roda.</p>
        </div>
      ) : (
        <div className="operationalAlertList">
          {alerts.map((alert) => (
            <button
              className={`operationalAlert ${alert.tone}`}
              key={alert.id}
              type="button"
              onClick={() => alert.deliveryId && onSelectDelivery?.(alert.deliveryId)}
            >
              {alert.tone === "critical" ? <AlertTriangle size={18} /> : alert.tone === "warning" ? <Clock3 size={18} /> : <Info size={18} />}
              <span>
                <strong>{alert.title}</strong>
                <small>{alert.description}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
