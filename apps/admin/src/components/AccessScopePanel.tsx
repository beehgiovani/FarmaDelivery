import type { AccessRole, AuthSession, StoreUnit } from "../types";

type AccessScopePanelProps = {
  role: AccessRole;
  selectedStore: string;
  stores: StoreUnit[];
  canUseAdminScope?: boolean;
  currentUser?: AuthSession | null;
  onRoleChange: (role: AccessRole) => void;
  onStoreChange: (store: string) => void;
};

export function AccessScopePanel({
  role,
  selectedStore,
  stores,
  canUseAdminScope = true,
  currentUser,
  onRoleChange,
  onStoreChange,
}: AccessScopePanelProps) {
  return (
    <section className="scopePanel" aria-label="Escopo de acesso">
      <div>
        <span className="eyebrow">Acesso atual</span>
        <h2>{role === "admin" ? "Visao geral admin" : `Visao da loja ${selectedStore}`}</h2>
        {currentUser ? (
          <small className="scopeUser">
            {currentUser.name} - {roleLabel(currentUser.role)}
          </small>
        ) : null}
      </div>

      <div className="scopeControls">
        <div className="segmentedControl" aria-label="Tipo de acesso">
          <button type="button" disabled={!canUseAdminScope} className={role === "admin" ? "selected" : ""} onClick={() => onRoleChange("admin")}>
            Admin
          </button>
          <button type="button" className={role === "loja" ? "selected" : ""} onClick={() => onRoleChange("loja")}>
            Loja
          </button>
        </div>

        <label className="compactSelect">
          <span>Unidade</span>
          <select disabled={role === "admin" || !canUseAdminScope} value={selectedStore} onChange={(event) => onStoreChange(event.target.value)}>
            {stores.map((store) => (
              <option key={store.name}>{store.name}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function roleLabel(role: AuthSession["role"]) {
  const labels: Record<AuthSession["role"], string> = {
    ADMIN: "Admin",
  GERENTE: "Acesso da loja",
  BALCONISTA_CAIXA: "Balconista / caixa (referencia)",
    MOTOBOY: "Motoboy",
  };
  return labels[role];
}
