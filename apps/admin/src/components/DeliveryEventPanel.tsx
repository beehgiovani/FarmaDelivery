import { Clock3 } from "lucide-react";
import { deliveryProofAuthHeaders, deliveryProofFileUrl } from "../api";
import { mapRawDeliveryEventTypeLabel } from "../apiMappers";
import type { Delivery, DeliveryEvent, DeliveryProof } from "../types";

type DeliveryEventPanelProps = {
  delivery?: Delivery | null;
  events: DeliveryEvent[];
  proofs?: DeliveryProof[];
  loading?: boolean;
  error?: string | null;
};

/** Mostra historico auditavel e comprovantes da entrega selecionada no painel. */
export function DeliveryEventPanel({ delivery, events, proofs = [], loading, error }: DeliveryEventPanelProps) {
  return (
    <section className="eventPanel" aria-label="Historico da entrega">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Auditoria</span>
          <h2>{delivery ? `Historico ${delivery.id.slice(0, 8)}` : "Historico da entrega"}</h2>
        </div>
        <Clock3 size={20} />
      </div>

      {!delivery ? (
        <div className="emptyList">Selecione uma entrega para ver o historico.</div>
      ) : loading ? (
        <div className="emptyList">Carregando historico...</div>
      ) : error ? (
        <div className="formFeedback error">{error}</div>
      ) : events.length === 0 && proofs.length === 0 ? (
        <div className="emptyList">Nenhum evento registrado para esta entrega.</div>
      ) : (
        <>
          <div className="eventTimeline">
            {events.map((event) => (
              <article className="eventItem" key={event.id}>
                <span className="eventDot" />
                <div>
                  <strong>{mapRawDeliveryEventTypeLabel(event.type)}</strong>
                  <small>
                    {formatDateTime(event.createdAt)}
                    {event.actor ? ` - ${event.actor.name}` : ""}
                  </small>
                  {event.notes ? <p>{event.notes}</p> : null}
                  {deliveryProofId(event) ? <small>Comprovante vinculado: {deliveryProofId(event)?.slice(0, 8)}</small> : null}
                </div>
              </article>
            ))}
          </div>
          {proofs.length > 0 ? (
            <div className="proofList">
              <strong>Comprovantes</strong>
              {proofs.map((proof) => (
                <button
                  className="inlineHistoryButton"
                  key={proof.id}
                  type="button"
                  onClick={() => {
                    void openDeliveryProof(proof).catch(() => {
                      window.alert("Nao foi possivel abrir o comprovante.");
                    });
                  }}
                >
                  {proof.fileName} - {formatFileSize(proof.sizeBytes)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Abre comprovante por endpoint autenticado, sem expor URL publica do arquivo. */
async function openDeliveryProof(proof: DeliveryProof) {
  const response = await fetch(deliveryProofFileUrl(proof.deliveryId, proof.id), {
    headers: deliveryProofAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Falha ao abrir comprovante: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Lê o id do comprovante salvo no metadata do evento, quando a entrega foi finalizada com foto. */
function deliveryProofId(event: DeliveryEvent) {
  const deliveryProof = event.metadata?.deliveryProof;
  if (deliveryProof && typeof deliveryProof === "object" && "id" in deliveryProof && typeof deliveryProof.id === "string") {
    return deliveryProof.id;
  }
  return null;
}

/** Exibe tamanho de arquivo em unidade legivel para o admin conferir o anexo. */
function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formata data/hora curta para a linha do tempo do historico. */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
