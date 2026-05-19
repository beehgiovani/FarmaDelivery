import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X } from "lucide-react";

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  tone: "success" | "error" | "info" | "loading";
};

type ToastStackProps = {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
};

export function ToastStack({ messages, onDismiss }: ToastStackProps) {
  if (messages.length === 0) return null;

  return (
    <div className="toastStack" aria-live="polite" aria-label="Notificacoes">
      {messages.map((message) => (
        <article className={`toastMessage ${message.tone}`} key={message.id}>
          <span className="toastIcon">{toastIcon(message.tone)}</span>
          <div>
            <strong>{message.title}</strong>
            {message.description ? <p>{message.description}</p> : null}
          </div>
          <button type="button" aria-label="Fechar notificacao" onClick={() => onDismiss(message.id)}>
            <X size={15} />
          </button>
        </article>
      ))}
    </div>
  );
}

function toastIcon(tone: ToastMessage["tone"]) {
  if (tone === "success") return <CheckCircle2 size={18} />;
  if (tone === "error") return <AlertTriangle size={18} />;
  if (tone === "loading") return <LoaderCircle size={18} />;
  return <Info size={18} />;
}
