import { AlertTriangle, Ban, CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Delivery } from "../types";

export type DeliveryActionDialogMode = "cancel" | "problem" | "complete";

type DeliveryActionDialogProps = {
  delivery: Delivery | null;
  mode: DeliveryActionDialogMode | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
};

/** Dialogo unico para acoes que precisam de motivo ou comprovante textual no historico da entrega. */
export function DeliveryActionDialog({ delivery, mode, loading = false, onClose, onConfirm }: DeliveryActionDialogProps) {
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const open = Boolean(delivery && mode);
  const minLength = mode === "problem" ? 5 : 3;
  const invalid = touched && notes.trim().length < minLength;
  const copy = dialogCopy(mode);

  useEffect(() => {
    if (open) {
      setNotes("");
      setTouched(false);
    }
  }, [open, delivery?.id, mode]);

  useEffect(() => {
    if (!open || loading) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose, open]);

  if (!delivery || !mode) return null;

  /** Valida o texto minimo antes de mandar a acao operacional para a API. */
  function handleConfirm() {
    setTouched(true);
    if (notes.trim().length < minLength || loading) return;
    onConfirm(notes.trim());
  }

  return (
    <div className="dialogOverlay" role="presentation" onMouseDown={loading ? undefined : onClose}>
      <section
        className="actionDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-action-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialogHeader">
          <span className={copy.iconClass}>
            {mode === "cancel" ? <Ban size={20} /> : mode === "complete" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          </span>
          <div>
            <strong id="delivery-action-title">{copy.title}</strong>
            <small>
              {delivery.customer} - {delivery.phone}
            </small>
          </div>
          <button type="button" aria-label="Fechar" disabled={loading} onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <div className="dialogDeliverySummary">
          <strong>{delivery.store}</strong>
          <span>{delivery.address}</span>
          <small>Status atual: {delivery.status}</small>
        </div>

        <label className="inputGroup wide">
          <span>{copy.fieldLabel}</span>
          <textarea
            value={notes}
            disabled={loading}
            onBlur={() => setTouched(true)}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={copy.placeholder}
          />
        </label>

        {invalid ? (
          <div className="fieldHint error">
            Informe pelo menos {minLength} caracteres para manter o historico da entrega claro.
          </div>
        ) : null}

        <div className="dialogActions">
          <button className="secondaryButton" type="button" disabled={loading} onClick={onClose}>
            Voltar
          </button>
          <button className={mode === "cancel" ? "dangerButton" : "primaryButton"} type="button" disabled={loading} onClick={handleConfirm}>
            {loading ? "Salvando..." : copy.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

/** Centraliza textos por modo para manter cancelamento, problema e conclusao consistentes. */
function dialogCopy(mode: DeliveryActionDialogMode | null) {
  if (mode === "cancel") {
    return {
      title: "Cancelar entrega",
      fieldLabel: "Motivo do cancelamento",
      placeholder: "Ex.: cliente desistiu, endereco incorreto, pedido duplicado",
      confirmLabel: "Cancelar entrega",
      iconClass: "dangerIcon",
    };
  }

  if (mode === "complete") {
    return {
      title: "Registrar entrega",
      fieldLabel: "Comprovante operacional",
      placeholder: "Ex.: entregue ao cliente, entregue na portaria, recebido por Maria",
      confirmLabel: "Concluir entrega",
      iconClass: "successIcon",
    };
  }

  return {
    title: "Registrar problema",
    fieldLabel: "Descricao do problema",
    placeholder: "Ex.: cliente ausente, portaria nao autorizou, endereco nao localizado",
    confirmLabel: "Salvar problema",
    iconClass: "warningIcon",
  };
}
