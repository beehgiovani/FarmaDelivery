import type { ReactNode } from "react";

type StateBlockProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  tone?: "neutral" | "loading" | "error" | "success";
  action?: ReactNode;
};

/** Bloco padrao para loading, vazio, erro e sucesso sem duplicar layout nas telas. */
export function StateBlock({ title, description, icon, tone = "neutral", action }: StateBlockProps) {
  return (
    <div className={`stateBlock ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {icon ? <span className="stateIcon">{icon}</span> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {tone === "loading" ? (
        <div className="loadingBars" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      ) : null}
      {action ? <div className="stateAction">{action}</div> : null}
    </div>
  );
}
