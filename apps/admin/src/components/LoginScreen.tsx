import { type FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { bootstrapAdmin, login } from "../api";
import { normalizeDeliveryPhoneInput } from "../deliveryPhone";
import type { AuthSession } from "../types";
import { userFacingError } from "../userMessages";

type LoginScreenProps = {
  onAuthenticated: (session: AuthSession) => void;
};

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [form, setForm] = useState({
    identifier: "",
    password: "",
    name: "",
    phone: "",
    email: "",
  });
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [feedback, setFeedback] = useState("");
  const loading = state === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setFeedback("");

    try {
      const session =
        mode === "login"
          ? await login({
              identifier: form.identifier.trim(),
              password: form.password,
            })
          : await bootstrapAdmin({
              name: form.name.trim(),
              phone: form.phone.trim() ? normalizeDeliveryPhoneInput(form.phone).trim() : undefined,
              email: form.email.trim(),
              password: form.password,
            });

      setState("success");
      onAuthenticated(session);
    } catch (error) {
      console.error("login error", error);
      setState("error");
      setFeedback(userFacingError(error, "Nao foi possivel entrar. Confira usuario e senha."));
    }
  }

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="loginBrand">
          <img src="/assets/drogaria-santo-antonio-logo.png" alt="Drogaria Santo Antonio" />
          <div>
            <strong>FarmaDelivery</strong>
            <span>Drogaria Santo Antonio</span>
          </div>
        </div>

        <div className="loginHeader">
          <span>{mode === "login" ? <KeyRound size={22} /> : <ShieldCheck size={22} />}</span>
          <div>
            <h1>{mode === "login" ? "Entrar no painel" : "Configurar primeiro admin"}</h1>
            <p>
              {mode === "login"
                ? "Use nome, email ou telefone cadastrado pela administracao."
                : "Use esta opcao somente na primeira configuracao do sistema."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="loginFormGrid">
            {mode === "bootstrap" ? (
              <>
                <label className="inputGroup">
                  <span>Nome</span>
                  <input
                    className="plainInput"
                    disabled={loading}
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </label>
                <label className="inputGroup">
                  <span>Telefone</span>
                  <input
                    className="plainInput"
                    disabled={loading}
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </label>
              </>
            ) : null}

            <label className="inputGroup wide">
              <span>{mode === "login" ? "Nome, email ou telefone" : "Email"}</span>
              <input
                className="plainInput"
                disabled={loading}
                value={mode === "login" ? form.identifier : form.email}
                onChange={(event) =>
                  mode === "login"
                    ? setForm({ ...form, identifier: event.target.value })
                    : setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label className="inputGroup wide">
              <span>Senha</span>
              <input
                className="plainInput"
                type="password"
                disabled={loading}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
          </div>

          {feedback ? <div className={`formFeedback ${state}`}>{feedback}</div> : null}

          <div className="loginActions">
            <button className="primaryButton" type="submit" disabled={loading}>
              {loading ? "Validando..." : mode === "login" ? "Entrar" : "Criar admin"}
            </button>
            <button
              className="secondaryButton"
              type="button"
              disabled={loading}
              onClick={() => {
                setMode(mode === "login" ? "bootstrap" : "login");
                setFeedback("");
                setState("idle");
              }}
            >
              {mode === "login" ? "Primeiro acesso" : "Voltar ao login"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
