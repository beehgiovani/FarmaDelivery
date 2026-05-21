import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FarmaDelivery UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatalState">
        <section>
          <span>
            <AlertTriangle size={26} />
          </span>
          <strong>Painel temporariamente indisponivel</strong>
          <p>A tela encontrou uma falha momentanea. Recarregue o painel para tentar novamente.</p>
          <small>Se continuar acontecendo, chame o suporte com o horario da ocorrencia.</small>
          <button type="button" className="primaryButton" onClick={() => window.location.reload()}>
            <RotateCcw size={17} />
            Recarregar painel
          </button>
        </section>
      </main>
    );
  }
}
