import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Clock3, Copy, Download, KeyRound, ShieldCheck, UserRoundCog } from "lucide-react";
import {
  assignmentLabel,
  buildAssignmentsCsv,
  emptyAssignmentHistoryFilters,
  getVisibleAssignments,
  isAssignmentDateRangeValid,
  matchesAssignmentFilters,
  type AssignmentHistoryFilters,
  type VisibleAssignment,
} from "../assignmentHistory";
import {
  createCourierAssignment,
  createStore,
  createStoreDateOverride,
  createUser,
  createUserAssignment,
  endAssignment,
  fetchAssignments,
  resetUserPassword,
  updateStoreWeeklyHours,
} from "../api";
import {
  buildCreatedAccessCard,
  buildStoreAccessRows,
  formatStoreHours,
  generateInitialPassword,
  mergeStoreUnits,
  requiresBaseStoreForRole,
  requiresLoginCredentialsForRole,
  storeBaseLabel,
  type CreatedAccessCard,
} from "../managementAccess";
import { hasEnoughDeliveryPhoneDigits, normalizeDeliveryPhoneInput } from "../deliveryPhone";
import type { AssignmentKind, AssignmentSummary, StoreUnit, TeamRole, TeamUser } from "../types";
import { userFacingError } from "../userMessages";
import { StateBlock } from "./StateBlock";

type ManagementPanelProps = {
  stores: StoreUnit[];
  users: TeamUser[];
  usersLoading?: boolean;
  usersError?: string | null;
  onUserCreated?: () => void;
  onStoreChanged?: () => void;
};

const roles: Array<{ value: TeamRole; label: string }> = [
  { value: "MOTOBOY", label: "Motoboy" },
  { value: "GERENTE", label: "Acesso da loja" },
  { value: "BALCONISTA_CAIXA", label: "Balconista / caixa (referencia)" },
  { value: "ADMIN", label: "Admin" },
];

const assignmentKinds: Array<{ value: AssignmentKind; label: string }> = [
  { value: "TEMPORARIA", label: "Temporaria" },
  { value: "COBERTURA", label: "Cobertura" },
  { value: "DEDICADA", label: "Dedicada" },
  { value: "RODIZIO", label: "Rodizio" },
  { value: "BASE", label: "Base" },
];

type ManagementSection = "acessos" | "lojas" | "horarios" | "alocacoes";

export function ManagementPanel({
  stores,
  users,
  usersLoading = false,
  usersError,
  onUserCreated,
  onStoreChanged,
}: ManagementPanelProps) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "MOTOBOY" as TeamRole,
    storeId: stores[0]?.id ?? "",
  });
  const [storeForm, setStoreForm] = useState({
    code: "",
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    baseType: "COMPARTILHADA" as "COMPARTILHADA" | "DEDICADA",
    opensAt: "08:00",
    closesAt: "22:00",
  });
  const [hoursForm, setHoursForm] = useState({
    storeId: stores[0]?.id ?? "",
    opensAt: "08:00",
    closesAt: "22:00",
    closed: false,
  });
  const [overrideForm, setOverrideForm] = useState({
    storeId: stores[0]?.id ?? "",
    date: "",
    opensAt: "08:00",
    closesAt: "22:00",
    closed: false,
    reason: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    targetType: "user" as "user" | "courier",
    userId: "",
    courierId: "",
    storeId: stores[0]?.id ?? "",
    kind: "TEMPORARIA" as AssignmentKind,
    startsAt: "",
    endsAt: "",
    reason: "",
  });
  const [assignments, setAssignments] = useState<AssignmentSummary>({ users: [], couriers: [] });
  const [showAssignmentHistory, setShowAssignmentHistory] = useState(false);
  const [assignmentHistoryFilters, setAssignmentHistoryFilters] = useState<AssignmentHistoryFilters>(emptyAssignmentHistoryFilters);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState("");
  const [assignmentState, setAssignmentState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [storeSubmitState, setStoreSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");
  const [storeFeedback, setStoreFeedback] = useState("");
  const [createdAccess, setCreatedAccess] = useState<CreatedAccessCard | null>(null);
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ManagementSection>("acessos");
  const [optimisticStores, setOptimisticStores] = useState<StoreUnit[]>([]);
  const accessFormRef = useRef<HTMLFormElement | null>(null);
  const managedStores = useMemo(() => mergeStoreUnits(stores, optimisticStores), [stores, optimisticStores]);
  const motoboys = useMemo(() => users.filter((user) => user.role === "MOTOBOY"), [users]);
  const storeUsers = useMemo(() => users.filter((user) => user.role !== "MOTOBOY"), [users]);
  const storeAccessRows = useMemo(() => buildStoreAccessRows(managedStores, users), [managedStores, users]);
  const activeStoreUsersCount = useMemo(() => storeAccessRows.reduce((total, row) => total + row.users.length, 0), [storeAccessRows]);
  const storesWithCoordinates = useMemo(() => managedStores.filter((store) => store.coordinates).length, [managedStores]);
  const storesWithDefaultHours = useMemo(() => managedStores.filter((store) => store.weeklyHours?.length).length, [managedStores]);

  useEffect(() => {
    if (form.role !== "BALCONISTA_CAIXA" && !form.storeId && managedStores[0]?.id) {
      setForm((current) => ({ ...current, storeId: managedStores[0].id ?? "" }));
    }
    if (!hoursForm.storeId && managedStores[0]?.id) {
      setHoursForm((current) => ({ ...current, storeId: managedStores[0].id ?? "" }));
    }
    if (!overrideForm.storeId && managedStores[0]?.id) {
      setOverrideForm((current) => ({ ...current, storeId: managedStores[0].id ?? "" }));
    }
    if (!assignmentForm.storeId && managedStores[0]?.id) {
      setAssignmentForm((current) => ({ ...current, storeId: managedStores[0].id ?? "" }));
    }
    if (!assignmentForm.userId && storeUsers[0]?.id) {
      setAssignmentForm((current) => ({ ...current, userId: storeUsers[0].id }));
    }
    if (!assignmentForm.courierId && motoboys[0]?.courier?.id) {
      setAssignmentForm((current) => ({ ...current, courierId: motoboys[0].courier?.id ?? "" }));
    }
  }, [
    assignmentForm.courierId,
    assignmentForm.storeId,
    assignmentForm.userId,
    form.role,
    form.storeId,
    hoursForm.storeId,
    motoboys,
    overrideForm.storeId,
    storeUsers,
    managedStores,
  ]);

  useEffect(() => {
    void loadAssignments();
  }, [showAssignmentHistory]);
  const actions = [
    {
      title: "Cadastrar lojas",
      description: `${managedStores.length} unidade(s) cadastrada(s) para a operacao.`,
      icon: <Building2 size={20} />,
      tone: "blue" as const,
      section: "lojas" as const,
    },
    {
      title: "Acessos da equipe",
      description: `${motoboys.length} motoboy(s) e ${storeUsers.length} usuario(s) de loja/admin.`,
      icon: <UserRoundCog size={20} />,
      tone: "green" as const,
      section: "acessos" as const,
    },
    {
      title: "Horarios das lojas",
      description: "Semana padrao e datas especificas por unidade.",
      icon: <Clock3 size={20} />,
      tone: "blue" as const,
      section: "horarios" as const,
    },
    {
      title: "Emprestimos e rodizios",
      description: `${activeStoreUsersCount} acesso(s) de loja ativo(s) e alocacoes.`,
      icon: <ShieldCheck size={20} />,
      tone: "red" as const,
      section: "alocacoes" as const,
    },
  ];

  function prepareStoreLogin(store: StoreUnit) {
    setActiveSection("acessos");
    setForm((current) => ({
      ...current,
      name: "",
      phone: "",
      email: "",
      password: generateInitialPassword(),
      role: "GERENTE",
      storeId: store.id ?? "",
    }));
    setSubmitState("idle");
    setCreatedAccess(null);
    setFeedback(`Formulario preparado para criar o login da loja ${store.name}. Informe o identificador e telefone/email da unidade.`);
    window.setTimeout(() => {
      accessFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      accessFormRef.current?.querySelector<HTMLInputElement>("input[name='team-user-name']")?.focus();
    }, 0);
  }

  function setFormForRole(role: TeamRole) {
    setForm((current) => ({
      ...current,
      role,
      storeId: role === "BALCONISTA_CAIXA" ? "" : current.storeId || managedStores[0]?.id || "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requiresLogin = requiresLoginCredentialsForRole(form.role);
    const normalizedPhone = normalizeDeliveryPhoneInput(form.phone);
    const phoneForLogin = hasEnoughDeliveryPhoneDigits(normalizedPhone) ? normalizedPhone : "";
    const emailForLogin = form.email.trim();
    if (!form.name.trim()) {
      setSubmitState("error");
      setFeedback("Informe o nome para este cadastro.");
      return;
    }
    if (requiresLogin && form.password.length < 8) {
      setSubmitState("error");
      setFeedback("Informe senha inicial com pelo menos 8 caracteres.");
      return;
    }
    if (requiresLogin && !emailForLogin && !phoneForLogin) {
      setSubmitState("error");
      setFeedback("Informe telefone ou email para a pessoa conseguir entrar.");
      setForm((current) => ({ ...current, phone: normalizedPhone }));
      return;
    }
    if (requiresBaseStoreForRole(form.role) && !form.storeId) {
      setSubmitState("error");
      setFeedback("Escolha a loja base para este cadastro.");
      return;
    }

    setSubmitState("loading");
    setFeedback("");
    setCreatedAccess(null);

    try {
      const selectedStoreName = managedStores.find((store) => store.id === form.storeId)?.name ?? "Sem loja fixa";
      const created = await createUser({
        name: form.name.trim(),
        phone: phoneForLogin || undefined,
        email: emailForLogin || undefined,
        password: requiresLogin ? form.password : undefined,
        role: form.role,
        storeId: form.role === "BALCONISTA_CAIXA" ? undefined : form.storeId || undefined,
      });
      setSubmitState("success");
      setFeedback(
        requiresLogin
          ? `${created.name} cadastrado com sucesso.`
          : `${created.name} cadastrado como referencia de balconista para autocomplete.`,
      );
      setCreatedAccess(
        requiresLogin
          ? buildCreatedAccessCard({
              name: created.name,
              email: created.email,
              phone: created.phone,
              password: form.password,
              role: form.role,
              storeName: created.store?.name ?? selectedStoreName,
            })
          : null,
      );
      setForm((current) => ({
        ...current,
        name: "",
        phone: "",
        email: "",
        password: "",
      }));
      onUserCreated?.();
    } catch (error) {
      console.error("team user create error", error);
      setSubmitState("error");
      setFeedback(userFacingError(error, "Nao foi possivel criar o acesso agora."));
    }
  }

  async function handleCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeForm.code.trim() || !storeForm.name.trim() || !storeForm.address.trim()) {
      setStoreSubmitState("error");
      setStoreFeedback("Informe codigo, nome e endereco da loja.");
      return;
    }

    const coordinates = parseCoordinates(storeForm.latitude, storeForm.longitude);
    if ((storeForm.latitude || storeForm.longitude) && !coordinates) {
      setStoreSubmitState("error");
      setStoreFeedback("Confira latitude e longitude da loja.");
      return;
    }

    setStoreSubmitState("loading");
    setStoreFeedback("");

    try {
      const createdStore = await createStore({
        code: storeForm.code.trim(),
        name: storeForm.name.trim(),
        address: storeForm.address.trim(),
        baseType: storeForm.baseType,
        coordinates: coordinates ?? undefined,
        weeklyHours: buildWeekHours(storeForm.opensAt, storeForm.closesAt, false),
      });
      setStoreSubmitState("success");
      setStoreFeedback(`${storeForm.name} cadastrada.`);
      setOptimisticStores((current) => mergeStoreUnits(current, [createdStore]));
      setStoreForm({
        code: "",
        name: "",
        address: "",
        latitude: "",
        longitude: "",
        baseType: "COMPARTILHADA",
        opensAt: "08:00",
        closesAt: "22:00",
      });
      onStoreChanged?.();
      prepareStoreLogin(createdStore);
      setFeedback(`Loja ${createdStore.name} cadastrada. Informe telefone ou email para criar o login operacional da unidade.`);
    } catch (error) {
      console.error("store create error", error);
      setStoreSubmitState("error");
      setStoreFeedback(userFacingError(error, "Nao foi possivel criar a loja agora."));
    }
  }

  async function handleUpdateWeeklyHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hoursForm.storeId) return;
    setStoreSubmitState("loading");
    setStoreFeedback("");
    try {
      await updateStoreWeeklyHours(
        hoursForm.storeId,
        buildWeekHours(hoursForm.opensAt, hoursForm.closesAt, hoursForm.closed),
      );
      setStoreSubmitState("success");
      setStoreFeedback("Horario semanal atualizado.");
      onStoreChanged?.();
    } catch (error) {
      console.error("store weekly hours update error", error);
      setStoreSubmitState("error");
      setStoreFeedback(userFacingError(error, "Nao foi possivel atualizar o horario agora."));
    }
  }

  async function handleCreateOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overrideForm.storeId || !overrideForm.date) {
      setStoreSubmitState("error");
      setStoreFeedback("Escolha loja e data do horario especial.");
      return;
    }
    setStoreSubmitState("loading");
    setStoreFeedback("");
    try {
      await createStoreDateOverride(overrideForm.storeId, {
        date: overrideForm.date,
        opensAt: overrideForm.closed ? undefined : overrideForm.opensAt,
        closesAt: overrideForm.closed ? undefined : overrideForm.closesAt,
        closed: overrideForm.closed,
        reason: overrideForm.reason.trim() || undefined,
      });
      setStoreSubmitState("success");
      setStoreFeedback("Horario especial salvo.");
      setOverrideForm((current) => ({ ...current, date: "", reason: "" }));
      onStoreChanged?.();
    } catch (error) {
      console.error("store date override create error", error);
      setStoreSubmitState("error");
      setStoreFeedback(userFacingError(error, "Nao foi possivel salvar o horario especial agora."));
    }
  }

  async function loadAssignments() {
    setAssignmentLoading(true);
    try {
      setAssignments(await fetchAssignments({ includeInactive: showAssignmentHistory }));
      setAssignmentFeedback("");
      setAssignmentState("idle");
    } catch (error) {
      console.error("assignment history load error", error);
      setAssignmentState("error");
      setAssignmentFeedback(userFacingError(error, "Nao foi possivel carregar emprestimos e rodizios."));
    } finally {
      setAssignmentLoading(false);
    }
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentForm.storeId) {
      setAssignmentState("error");
      setAssignmentFeedback("Escolha a loja da alocacao.");
      return;
    }

    const startsAt = dateTimeLocalToIso(assignmentForm.startsAt);
    const endsAt = dateTimeLocalToIso(assignmentForm.endsAt);
    const payload = {
      storeId: assignmentForm.storeId,
      kind: assignmentForm.kind,
      startsAt,
      endsAt,
      reason: assignmentForm.reason.trim() || undefined,
    };

    setAssignmentState("loading");
    setAssignmentFeedback("");

    try {
      if (assignmentForm.targetType === "user") {
        if (!assignmentForm.userId) throw new Error("Escolha o usuario.");
        await createUserAssignment({
          ...payload,
          userId: assignmentForm.userId,
        });
      } else {
        if (!assignmentForm.courierId) throw new Error("Escolha o motoboy.");
        await createCourierAssignment({
          ...payload,
          courierId: assignmentForm.courierId,
        });
      }
      setAssignmentState("success");
      setAssignmentFeedback("Alocacao salva.");
      setAssignmentForm((current) => ({ ...current, reason: "", endsAt: "" }));
      await loadAssignments();
    } catch (error) {
      console.error("assignment create error", error);
      setAssignmentState("error");
      setAssignmentFeedback(userFacingError(error, "Nao foi possivel salvar a alocacao agora."));
    }
  }

  async function handleEndAssignment(type: "users" | "couriers", assignmentId: string) {
    setAssignmentState("loading");
    setAssignmentFeedback("");
    try {
      await endAssignment(type, assignmentId);
      setAssignmentState("success");
      setAssignmentFeedback("Alocacao encerrada.");
      await loadAssignments();
    } catch (error) {
      console.error("assignment end error", error);
      setAssignmentState("error");
      setAssignmentFeedback(userFacingError(error, "Nao foi possivel encerrar a alocacao agora."));
    }
  }

  async function handleResetPassword(user: TeamUser) {
    const password = generateInitialPassword();
    const login = user.email?.trim() || user.phone?.trim();
    if (!login) {
      setSubmitState("error");
      setFeedback("Este usuario precisa ter telefone ou email antes de redefinir a senha.");
      return;
    }
    if (!window.confirm(`Redefinir a senha de ${user.name}?`)) return;

    setPasswordResetUserId(user.id);
    setSubmitState("loading");
    setFeedback("");
    setCreatedAccess(null);

    try {
      const updated = await resetUserPassword(user.id, password);
      setSubmitState("success");
      setFeedback(`Senha de ${updated.name} redefinida com sucesso.`);
      setCreatedAccess(buildCreatedAccessCard({
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        password,
        role: updated.role,
        storeName: user.store?.name ?? user.courier?.baseStoreName ?? "Sem loja fixa",
      }));
    } catch (error) {
      console.error("team user password reset error", error);
      setSubmitState("error");
      setFeedback(userFacingError(error, "Nao foi possivel redefinir a senha agora."));
    } finally {
      setPasswordResetUserId(null);
    }
  }

  return (
    <section className="managementPanel" id="permissoes">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Cadastros e controle</h2>
        </div>
      </div>

      <div className="managementGrid">
        {actions.map((action) => (
          <button
            className={`managementCard ${action.tone}${activeSection === action.section ? " selected" : ""}`}
            key={action.title}
            type="button"
            onClick={() => setActiveSection(action.section)}
          >
            <span>{action.icon}</span>
            <div>
              <strong>{action.title}</strong>
              <small>{action.description}</small>
            </div>
          </button>
        ))}
      </div>

      {activeSection === "acessos" ? (
        <section className="storeAccessPanel" aria-label="Acessos por loja">
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">Acessos por loja</span>
              <h2>Login da unidade</h2>
            </div>
          </div>
          <div className="storeAccessGrid">
            {storeAccessRows.map(({ store, users }) => (
              <article className={`storeAccessCard${users.length === 0 ? " warning" : ""}`} key={store.id ?? store.name}>
                <div>
                  <strong>{store.name}</strong>
                  <small>{users.length > 0 ? `${users.length} acesso(s) ativo(s)` : "Sem acesso de loja ativo"}</small>
                </div>
                <span className={`statusPill ${users.length === 0 ? "issue" : ""}`}>{users.length > 0 ? "Pronta" : "Criar acesso"}</span>
                <button className="secondaryButton compactButton" type="button" disabled={!store.id} onClick={() => prepareStoreLogin(store)}>
                  Preparar login
                </button>
                {users.length > 0 ? (
                  <small className="storeAccessNames">{users.map((user) => user.name).join(", ")}</small>
                ) : (
                  <small className="storeAccessNames">Use um login operacional para esta loja.</small>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="managementWorkspace">
        {activeSection === "lojas" ? (
        <>
          <form className="teamForm storeCreateForm" onSubmit={handleCreateStore}>
            <div className="sectionHeader">
              <div>
                <span className="eyebrow">Unidades</span>
                <h2>Nova loja</h2>
              </div>
            </div>

            <div className="storeSetupNotice">
              <strong>Cadastro da unidade</strong>
              <small>Depois de salvar a loja, crie em Acessos da equipe o login operacional da unidade. Balconistas ficam como referencia de conferencia.</small>
            </div>

            <div className="teamFormGrid">
              <label className="inputGroup">
                <span>Codigo interno</span>
                <input
                  className="plainInput"
                  value={storeForm.code}
                  placeholder="Ex: ASTURIAS"
                  onChange={(event) => setStoreForm({ ...storeForm, code: event.target.value.toUpperCase().replace(/\s+/g, "_") })}
                />
              </label>
              <label className="inputGroup">
                <span>Nome da loja</span>
                <input className="plainInput" value={storeForm.name} placeholder="Ex: Asturias" onChange={(event) => setStoreForm({ ...storeForm, name: event.target.value })} />
              </label>
              <label className="inputGroup wide">
                <span>Endereco da unidade</span>
                <input
                  className="plainInput"
                  value={storeForm.address}
                  placeholder="Rua, numero, bairro, Guaruja - SP"
                  onChange={(event) => setStoreForm({ ...storeForm, address: event.target.value })}
                />
              </label>
              <label className="inputGroup">
                <span>Latitude opcional</span>
                <input className="plainInput" value={storeForm.latitude} placeholder="-23.99" onChange={(event) => setStoreForm({ ...storeForm, latitude: event.target.value })} />
              </label>
              <label className="inputGroup">
                <span>Longitude opcional</span>
                <input className="plainInput" value={storeForm.longitude} placeholder="-46.25" onChange={(event) => setStoreForm({ ...storeForm, longitude: event.target.value })} />
              </label>
              <label className="inputGroup">
                <span>Operacao dos motoboys</span>
                <select value={storeForm.baseType} onChange={(event) => setStoreForm({ ...storeForm, baseType: event.target.value as "COMPARTILHADA" | "DEDICADA" })}>
                  <option value="COMPARTILHADA">Base compartilhada</option>
                  <option value="DEDICADA">Base dedicada</option>
                </select>
              </label>
              <label className="inputGroup">
                <span>Horario padrao</span>
                <div className="timePair">
                  <input className="plainInput" type="time" value={storeForm.opensAt} onChange={(event) => setStoreForm({ ...storeForm, opensAt: event.target.value })} />
                  <input className="plainInput" type="time" value={storeForm.closesAt} onChange={(event) => setStoreForm({ ...storeForm, closesAt: event.target.value })} />
                </div>
              </label>
            </div>

            {storeFeedback ? <div className={`formFeedback ${storeSubmitState}`}>{storeFeedback}</div> : null}

            <div className="formActions">
              <button className="primaryButton" type="submit" disabled={storeSubmitState === "loading"}>
                {storeSubmitState === "loading" ? "Cadastrando..." : "Cadastrar loja"}
              </button>
            </div>
          </form>

          <section className="teamList storeSetupPanel" aria-label="Lojas cadastradas">
            <div className="sectionHeader">
              <div>
                <span className="eyebrow">Unidades ativas</span>
                <h2>Lojas cadastradas</h2>
              </div>
            </div>
            <div className="storeSetupStats">
              <span>
                <strong>{managedStores.length}</strong>
                <small>lojas</small>
              </span>
              <span>
                <strong>{storesWithCoordinates}</strong>
                <small>com mapa</small>
              </span>
              <span>
                <strong>{storesWithDefaultHours}</strong>
                <small>com horario</small>
              </span>
            </div>

            <div className="storeSetupList">
              {managedStores.length === 0 ? (
                <div className="emptyList">Nenhuma loja cadastrada.</div>
              ) : (
                managedStores.map((store) => (
                  <article className="storeSetupRow" key={store.id ?? store.name}>
                    <div>
                      <strong>{store.name}</strong>
                      <small>{store.code} - {store.address}</small>
                    </div>
                    <div className="storeSetupMeta">
                      <span>{storeBaseLabel(store.baseType)}</span>
                      <span>{store.coordinates ? "Com ponto no mapa" : "Sem ponto no mapa"}</span>
                      <span>{formatStoreHours(store)}</span>
                    </div>
                    <button className="secondaryButton compactButton" type="button" disabled={!store.id} onClick={() => prepareStoreLogin(store)}>
                      Preparar login
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
        ) : null}

        {activeSection === "acessos" ? (
        <form className="teamForm" ref={accessFormRef} onSubmit={handleSubmit}>
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">Equipe</span>
              <h2>{requiresLoginCredentialsForRole(form.role) ? "Novo acesso" : "Nova referencia"}</h2>
            </div>
          </div>

          <div className="accessHelperCard">
            <span>
              <KeyRound size={18} />
            </span>
            <div>
              <strong>{requiresLoginCredentialsForRole(form.role) ? "Login criado pelo admin" : "Referencia para autocomplete"}</strong>
              <small>
                {requiresLoginCredentialsForRole(form.role)
                  ? "Use telefone ou email como identificador do acesso. A senha inicial pode ser alterada depois pelo admin."
                  : "Cadastre somente o nome do balconista/caixa para selecionar ao lancar entregas."}
              </small>
            </div>
          </div>

          <div className="teamFormGrid">
            <label className="inputGroup">
              <span>Nome</span>
              <input
                className="plainInput"
                name="team-user-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="inputGroup">
              <span>Telefone</span>
              <input
                className="plainInput"
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: normalizeDeliveryPhoneInput(event.target.value) })}
              />
            </label>
            <label className="inputGroup">
              <span>Email</span>
              <input className="plainInput" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            {requiresLoginCredentialsForRole(form.role) ? (
              <label className="inputGroup">
                <span>Senha inicial</span>
                <div className="inputWithButton">
                  <input
                    className="plainInput"
                    type="text"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    placeholder="Minimo 8 caracteres"
                  />
                  <button className="secondaryButton compactButton" type="button" onClick={() => setForm({ ...form, password: generateInitialPassword() })}>
                    Gerar
                  </button>
                </div>
              </label>
            ) : null}
            <label className="inputGroup">
              <span>Funcao</span>
              <select value={form.role} onChange={(event) => setFormForRole(event.target.value as TeamRole)}>
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inputGroup">
              <span>{form.role === "BALCONISTA_CAIXA" ? "Loja base opcional" : "Loja base"}</span>
              <select value={form.storeId} onChange={(event) => setForm({ ...form, storeId: event.target.value })}>
                <option value="">Sem loja fixa</option>
                {managedStores.map((store) => (
                  <option key={store.id ?? store.name} value={store.id ?? ""}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {feedback ? <div className={`formFeedback ${submitState}`}>{feedback}</div> : null}
          {createdAccess ? <CreatedAccessSummary access={createdAccess} /> : null}

          <div className="formActions">
            <button className="primaryButton" type="submit" disabled={submitState === "loading"}>
              {submitState === "loading"
                ? "Cadastrando..."
                : requiresLoginCredentialsForRole(form.role)
                  ? "Cadastrar acesso"
                  : "Cadastrar referencia"}
            </button>
          </div>
        </form>
        ) : null}

        {activeSection === "horarios" ? (
        <>
        <form className="teamForm" onSubmit={handleUpdateWeeklyHours}>
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">Horarios</span>
              <h2>Horario semanal</h2>
            </div>
          </div>
          <div className="teamFormGrid">
            <StoreSelect stores={managedStores} value={hoursForm.storeId} onChange={(storeId) => setHoursForm({ ...hoursForm, storeId })} />
            <label className="inputGroup">
              <span>Abre / fecha</span>
              <div className="timePair">
                <input className="plainInput" type="time" disabled={hoursForm.closed} value={hoursForm.opensAt} onChange={(event) => setHoursForm({ ...hoursForm, opensAt: event.target.value })} />
                <input className="plainInput" type="time" disabled={hoursForm.closed} value={hoursForm.closesAt} onChange={(event) => setHoursForm({ ...hoursForm, closesAt: event.target.value })} />
              </div>
            </label>
            <label className="checkLine wide">
              <input type="checkbox" checked={hoursForm.closed} onChange={(event) => setHoursForm({ ...hoursForm, closed: event.target.checked })} />
              Loja fechada todos os dias neste padrao
            </label>
          </div>
          <div className="formActions">
            <button className="secondaryButton" type="submit" disabled={storeSubmitState === "loading"}>
              Atualizar semana
            </button>
          </div>
        </form>

        <form className="teamForm" onSubmit={handleCreateOverride}>
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">Excecoes</span>
              <h2>Data especifica</h2>
            </div>
          </div>
          <div className="teamFormGrid">
            <StoreSelect stores={managedStores} value={overrideForm.storeId} onChange={(storeId) => setOverrideForm({ ...overrideForm, storeId })} />
            <label className="inputGroup">
              <span>Data</span>
              <input className="plainInput" type="date" value={overrideForm.date} onChange={(event) => setOverrideForm({ ...overrideForm, date: event.target.value })} />
            </label>
            <label className="inputGroup">
              <span>Abre / fecha</span>
              <div className="timePair">
                <input className="plainInput" type="time" disabled={overrideForm.closed} value={overrideForm.opensAt} onChange={(event) => setOverrideForm({ ...overrideForm, opensAt: event.target.value })} />
                <input className="plainInput" type="time" disabled={overrideForm.closed} value={overrideForm.closesAt} onChange={(event) => setOverrideForm({ ...overrideForm, closesAt: event.target.value })} />
              </div>
            </label>
            <label className="inputGroup">
              <span>Motivo</span>
              <input className="plainInput" value={overrideForm.reason} onChange={(event) => setOverrideForm({ ...overrideForm, reason: event.target.value })} />
            </label>
            <label className="checkLine wide">
              <input type="checkbox" checked={overrideForm.closed} onChange={(event) => setOverrideForm({ ...overrideForm, closed: event.target.checked })} />
              Loja fechada nesta data
            </label>
          </div>
          <div className="formActions">
            <button className="secondaryButton" type="submit" disabled={storeSubmitState === "loading"}>
              Salvar data
            </button>
          </div>
          {storeFeedback ? <div className={`formFeedback ${storeSubmitState}`}>{storeFeedback}</div> : null}
        </form>
        </>
        ) : null}

        {activeSection === "alocacoes" ? (
        <form className="teamForm" onSubmit={handleCreateAssignment}>
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">Alocacoes</span>
              <h2>Emprestimo e rodizio</h2>
            </div>
          </div>
          <div className="teamFormGrid">
            <label className="inputGroup">
              <span>Tipo</span>
              <select
                value={assignmentForm.targetType}
                onChange={(event) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    targetType: event.target.value as "user" | "courier",
                    kind: event.target.value === "courier" ? "COBERTURA" : "TEMPORARIA",
                  })
                }
              >
                <option value="user">Usuario de loja</option>
                <option value="courier">Motoboy</option>
              </select>
            </label>

            {assignmentForm.targetType === "user" ? (
              <label className="inputGroup">
                <span>Usuario</span>
                <select value={assignmentForm.userId} onChange={(event) => setAssignmentForm({ ...assignmentForm, userId: event.target.value })}>
                  {storeUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="inputGroup">
                <span>Motoboy</span>
                <select
                  value={assignmentForm.courierId}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, courierId: event.target.value })}
                >
                  {motoboys
                    .filter((user) => user.courier?.id)
                    .map((user) => (
                      <option key={user.courier!.id} value={user.courier!.id}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <StoreSelect stores={managedStores} value={assignmentForm.storeId} onChange={(storeId) => setAssignmentForm({ ...assignmentForm, storeId })} />
            <label className="inputGroup">
              <span>Regra</span>
              <select value={assignmentForm.kind} onChange={(event) => setAssignmentForm({ ...assignmentForm, kind: event.target.value as AssignmentKind })}>
                {assignmentKinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inputGroup">
              <span>Inicio</span>
              <input
                className="plainInput"
                type="datetime-local"
                value={assignmentForm.startsAt}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, startsAt: event.target.value })}
              />
            </label>
            <label className="inputGroup">
              <span>Fim</span>
              <input
                className="plainInput"
                type="datetime-local"
                value={assignmentForm.endsAt}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, endsAt: event.target.value })}
              />
            </label>
            <label className="inputGroup wide">
              <span>Motivo</span>
              <input
                className="plainInput"
                value={assignmentForm.reason}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, reason: event.target.value })}
              />
            </label>
          </div>
          <div className="formActions">
            <button className="secondaryButton" type="submit" disabled={assignmentState === "loading"}>
              Salvar alocacao
            </button>
          </div>
          {assignmentFeedback ? <div className={`formFeedback ${assignmentState}`}>{assignmentFeedback}</div> : null}
        </form>
        ) : null}

        {activeSection === "acessos" ? (
        <div className="teamList">
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">Controle</span>
              <h2>Equipe cadastrada</h2>
            </div>
            <div className="sectionActions">
              <strong>{users.length} usuarios</strong>
              <button
                className="secondaryButton compactButton"
                type="button"
                onClick={() => setShowAssignmentHistory((current) => !current)}
              >
                {showAssignmentHistory ? "Ocultar historico" : "Ver historico"}
              </button>
            </div>
          </div>

          <div className="teamGroups">
            {usersLoading ? (
              <StateBlock tone="loading" title="Carregando equipe" description="Buscando usuarios cadastrados." />
            ) : usersError ? (
              <StateBlock tone="error" title="Nao foi possivel carregar equipe" description={usersError} />
            ) : (
              <>
                <UserGroup title="Motoboys" users={motoboys} resettingUserId={passwordResetUserId} onResetPassword={handleResetPassword} />
                <UserGroup title="Loja e admin" users={storeUsers} resettingUserId={passwordResetUserId} onResetPassword={handleResetPassword} />
              </>
            )}
          </div>
        </div>
        ) : null}

        {activeSection === "alocacoes" ? (
          <div className="teamList">
            <div className="sectionHeader">
              <div>
                <span className="eyebrow">Controle</span>
                <h2>Alocacoes ativas e historico</h2>
              </div>
              <div className="sectionActions">
                <button
                  className="secondaryButton compactButton"
                  type="button"
                  onClick={() => setShowAssignmentHistory((current) => !current)}
                >
                  {showAssignmentHistory ? "Ocultar historico" : "Ver historico"}
                </button>
              </div>
            </div>
            <div className="teamGroups">
              <AssignmentGroup
                loading={assignmentLoading}
                assignments={assignments}
                showHistory={showAssignmentHistory}
                stores={managedStores}
                filters={assignmentHistoryFilters}
                onFiltersChange={setAssignmentHistoryFilters}
                onEndAssignment={handleEndAssignment}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StoreSelect({ stores, value, onChange }: { stores: StoreUnit[]; value: string; onChange: (storeId: string) => void }) {
  return (
    <label className="inputGroup">
      <span>Loja</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {stores.map((store) => (
          <option key={store.id ?? store.name} value={store.id ?? ""}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function CreatedAccessSummary({ access }: { access: CreatedAccessCard }) {
  const accessText = [
    `Nome: ${access.name}`,
    `Funcao: ${roleLabel(access.role)}`,
    `Loja: ${access.storeName}`,
    `Login: ${access.login}`,
    `Senha inicial: ${access.password}`,
  ].join("\n");

  async function copyAccess() {
    try {
      await navigator.clipboard.writeText(accessText);
    } catch {
      console.info("Nao foi possivel copiar automaticamente os dados do acesso.");
    }
  }

  return (
    <div className="createdAccessCard" role="status">
      <div>
        <strong>Acesso criado</strong>
        <small>Entregue estes dados diretamente para a pessoa responsavel.</small>
      </div>
      <dl>
        <div>
          <dt>Login</dt>
          <dd>{access.login}</dd>
        </div>
        <div>
          <dt>Senha inicial</dt>
          <dd>{access.password}</dd>
        </div>
        <div>
          <dt>Loja</dt>
          <dd>{access.storeName}</dd>
        </div>
      </dl>
      <button className="secondaryButton compactButton" type="button" onClick={() => void copyAccess()}>
        <Copy size={15} /> Copiar dados
      </button>
    </div>
  );
}

function buildWeekHours(opensAt: string, closesAt: string, closed: boolean) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt,
    closesAt,
    closed,
  }));
}

function parseCoordinates(latitude: string, longitude: string) {
  if (!latitude.trim() && !longitude.trim()) return null;
  if (!latitude.trim() || !longitude.trim()) return null;
  const lat = Number(latitude.replace(",", "."));
  const lng = Number(longitude.replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    latitude: lat,
    longitude: lng,
  };
}

function dateTimeLocalToIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function UserGroup({
  title,
  users,
  resettingUserId,
  onResetPassword,
}: {
  title: string;
  users: TeamUser[];
  resettingUserId?: string | null;
  onResetPassword?: (user: TeamUser) => void;
}) {
  return (
    <section className="teamGroup">
      <strong>{title}</strong>
      {users.length === 0 ? (
        <div className="emptyList">Nenhum usuario cadastrado.</div>
      ) : (
        users.map((user) => (
          <article className="teamRow" key={user.id}>
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {roleLabel(user.role)} - {user.store?.name ?? user.courier?.baseStoreName ?? "Sem loja"}
              </small>
            </div>
            <span className={`statusPill ${user.active ? "" : "issue"}`}>{user.active ? "Ativo" : "Inativo"}</span>
            {onResetPassword && requiresLoginCredentialsForRole(user.role) ? (
              <button
                className="secondaryButton compactButton"
                type="button"
                disabled={resettingUserId === user.id}
                onClick={() => onResetPassword(user)}
              >
                {resettingUserId === user.id ? "Redefinindo..." : "Redefinir senha"}
              </button>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}

function AssignmentGroup({
  loading,
  assignments,
  showHistory,
  stores,
  filters,
  onFiltersChange,
  onEndAssignment,
}: {
  loading: boolean;
  assignments: AssignmentSummary;
  showHistory: boolean;
  stores: StoreUnit[];
  filters: AssignmentHistoryFilters;
  onFiltersChange: (filters: AssignmentHistoryFilters) => void;
  onEndAssignment: (type: "users" | "couriers", assignmentId: string) => void;
}) {
  if (loading) {
    return <StateBlock tone="loading" title="Carregando alocacoes" description="Buscando emprestimos e rodizios ativos." />;
  }

  const activeUserAssignments = assignments.users.filter((assignment) =>
    matchesAssignmentFilters({ type: "usuario", assignment }, { ...filters, status: filters.status || "ativa" }),
  );
  const activeCourierAssignments = assignments.couriers.filter((assignment) =>
    matchesAssignmentFilters({ type: "motoboy", assignment }, { ...filters, status: filters.status || "ativa" }),
  );
  const validAssignmentDateRange = isAssignmentDateRangeValid(filters);
  const endedUserAssignments = assignments.users.filter((assignment) =>
    matchesAssignmentFilters({ type: "usuario", assignment }, { ...filters, status: filters.status || "encerrada" }),
  );
  const endedCourierAssignments = assignments.couriers.filter((assignment) =>
    matchesAssignmentFilters({ type: "motoboy", assignment }, { ...filters, status: filters.status || "encerrada" }),
  );
  const hasActiveAssignments = activeUserAssignments.length > 0 || activeCourierAssignments.length > 0;
  const hasEndedAssignments = endedUserAssignments.length > 0 || endedCourierAssignments.length > 0;
  const visibleAssignments = getVisibleAssignments(assignments, filters);
  const loadedAssignments = assignments.users.length + assignments.couriers.length;
  const people = [
    ...assignments.users.map((assignment) => ({ id: assignment.user.id, name: assignment.user.name })),
    ...assignments.couriers.map((assignment) => ({ id: assignment.courier.id, name: assignment.courier.name })),
  ].filter((person, index, all) => all.findIndex((candidate) => candidate.id === person.id) === index);

  return (
    <section className="teamGroup">
      {showHistory ? (
        <div className="assignmentFilters" aria-label="Filtros de alocacoes">
          <label>
            <span>Loja</span>
            <select value={filters.storeId} onChange={(event) => onFiltersChange({ ...filters, storeId: event.target.value })}>
              <option value="">Todas</option>
              {stores.map((store) => (
                <option key={store.id ?? store.name} value={store.id ?? ""}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Pessoa</span>
            <select value={filters.personId} onChange={(event) => onFiltersChange({ ...filters, personId: event.target.value })}>
              <option value="">Todas</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select value={filters.targetType} onChange={(event) => onFiltersChange({ ...filters, targetType: event.target.value as AssignmentHistoryFilters["targetType"] })}>
              <option value="">Todos</option>
              <option value="usuario">Usuario de loja</option>
              <option value="motoboy">Motoboy</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as AssignmentHistoryFilters["status"] })}>
              <option value="">Todos</option>
              <option value="ativa">Ativa</option>
              <option value="encerrada">Encerrada</option>
            </select>
          </label>
          <label>
            <span>Regra</span>
            <select value={filters.kind} onChange={(event) => onFiltersChange({ ...filters, kind: event.target.value as AssignmentHistoryFilters["kind"] })}>
              <option value="">Todas</option>
              {assignmentKinds.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>De</span>
            <input type="date" value={filters.startsAt} onChange={(event) => onFiltersChange({ ...filters, startsAt: event.target.value })} />
          </label>
          <label>
            <span>Ate</span>
            <input type="date" value={filters.endsAt} onChange={(event) => onFiltersChange({ ...filters, endsAt: event.target.value })} />
          </label>
          <button
            className="secondaryButton assignmentExportButton"
            type="button"
            disabled={!validAssignmentDateRange || visibleAssignments.length === 0}
            onClick={() => exportAssignmentsCsv(visibleAssignments, filters, loadedAssignments)}
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      ) : null}
      <strong>Alocacoes ativas</strong>
      {!hasActiveAssignments ? (
        <div className="emptyList">Nenhuma alocacao ativa.</div>
      ) : (
        <>
          {activeUserAssignments.map((assignment) => (
            <article className="teamRow" key={`user-${assignment.id}`}>
              <span className="avatar">{assignment.user.name.slice(0, 1)}</span>
              <div>
                <strong>{assignment.user.name}</strong>
                <small>
                  {assignmentLabel(assignment.kind)} - {assignment.store.name} - desde {formatDateTime(assignment.startsAt)}
                </small>
              </div>
              <button className="secondaryButton compactButton" type="button" onClick={() => onEndAssignment("users", assignment.id)}>
                Encerrar
              </button>
            </article>
          ))}
          {activeCourierAssignments.map((assignment) => (
            <article className="teamRow" key={`courier-${assignment.id}`}>
              <span className="avatar">{assignment.courier.name.slice(0, 1)}</span>
              <div>
                <strong>{assignment.courier.name}</strong>
                <small>
                  {assignmentLabel(assignment.kind)} - {assignment.store.name} - desde {formatDateTime(assignment.startsAt)}
                </small>
              </div>
              <button className="secondaryButton compactButton" type="button" onClick={() => onEndAssignment("couriers", assignment.id)}>
                Encerrar
              </button>
            </article>
          ))}
        </>
      )}
      {showHistory ? (
        <>
          <strong>Historico encerrado</strong>
          {!validAssignmentDateRange ? (
            <div className="emptyList">Periodo invalido: a data inicial precisa ser anterior ou igual a data final.</div>
          ) : !hasEndedAssignments ? (
            <div className="emptyList">Nenhuma alocacao encerrada.</div>
          ) : (
            <>
              {endedUserAssignments.map((assignment) => (
                <article className="teamRow mutedRow" key={`ended-user-${assignment.id}`}>
                  <span className="avatar">{assignment.user.name.slice(0, 1)}</span>
                  <div>
                    <strong>{assignment.user.name}</strong>
                    <small>
                      {assignmentLabel(assignment.kind)} - {assignment.store.name} - {formatDateTime(assignment.startsAt)} ate{" "}
                      {formatDateTime(assignment.endsAt)}
                    </small>
                  </div>
                  <span className="statusPill">Encerrada</span>
                </article>
              ))}
              {endedCourierAssignments.map((assignment) => (
                <article className="teamRow mutedRow" key={`ended-courier-${assignment.id}`}>
                  <span className="avatar">{assignment.courier.name.slice(0, 1)}</span>
                  <div>
                    <strong>{assignment.courier.name}</strong>
                    <small>
                      {assignmentLabel(assignment.kind)} - {assignment.store.name} - {formatDateTime(assignment.startsAt)} ate{" "}
                      {formatDateTime(assignment.endsAt)}
                    </small>
                  </div>
                  <span className="statusPill">Encerrada</span>
                </article>
              ))}
            </>
          )}
        </>
      ) : null}
    </section>
  );
}

function roleLabel(role: TeamRole) {
  const labels: Record<TeamRole, string> = {
    ADMIN: "Admin",
  GERENTE: "Acesso da loja",
  BALCONISTA_CAIXA: "Balconista / caixa (referencia)",
    MOTOBOY: "Motoboy",
  };
  return labels[role];
}

function formatDateTime(value?: string | null) {
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

function exportAssignmentsCsv(assignments: VisibleAssignment[], filters: AssignmentHistoryFilters, loadedAssignments: number) {
  const csv = buildAssignmentsCsv(assignments, {
    generatedAt: new Date().toISOString(),
    loadedAssignments,
    visibleAssignments: assignments.length,
    filters,
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `farmadelivery-alocacoes-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
