import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bike,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  cancelDelivery,
  acceptDelivery,
  collectDelivery,
  completeDelivery,
  fetchCurrentSession,
  fetchCourierRoutes,
  fetchCouriers,
  fetchDeliveryEvents,
  fetchDeliveryProofs,
  fetchDeliveryReportSummary,
  fetchDeliveries,
  fetchStoresWithSource,
  fetchUsers,
  recalculateCourierRoute,
  registerDeliveryProblem,
  setAuthToken,
  startDeliveryRoute,
  subscribeToDeliveryChanges,
  subscribeToRouteChanges,
  subscribeToStoreChanges,
  subscribeToUserChanges,
} from "./api";
import { couriers, deliveries as fallbackDeliveries, stores as fallbackStores } from "./data";
import { DeliveryForm } from "./components/DeliveryForm";
import { DeliveryAnalytics } from "./components/DeliveryAnalytics";
import { CourierRoutesPanel } from "./components/CourierRoutesPanel";
import { DeliveryActionDialog, type DeliveryActionDialogMode } from "./components/DeliveryActionDialog";
import { DeliveryEventPanel } from "./components/DeliveryEventPanel";
import { DeliveryTable } from "./components/DeliveryTable";
import { AccessScopePanel } from "./components/AccessScopePanel";
import { LoginScreen } from "./components/LoginScreen";
import { ManagementPanel } from "./components/ManagementPanel";
import { Metric } from "./components/Metric";
import { NotificationMonitorPanel } from "./components/NotificationMonitorPanel";
import { OperationsMap } from "./components/OperationsMap";
import { RouteBoard } from "./components/RouteBoard";
import { RouteStrategyPanel } from "./components/RouteStrategyPanel";
import { ReportsPanel } from "./components/ReportsPanel";
import { StoreVolume } from "./components/StoreVolume";
import { ToastStack, type ToastMessage } from "./components/ToastStack";
import { isDeliveryOverdue } from "./deliverySla";
import { deliveryMatchesReportDateRange, reportDateLabel } from "./reportPeriod";
import { userFacingError } from "./userMessages";
import type {
  AccessRole,
  AuthSession,
  CourierRoute,
  Delivery,
  DeliveryEvent,
  DeliveryProof,
  DeliveryReportSummary,
  DeliveryStatus,
  StoreUnit,
  TeamUser,
} from "./types";

const deliveryStatuses: DeliveryStatus[] = ["Aguardando", "Aceita", "Coletada", "Em rota", "Entregue", "Problema", "Cancelada"];
const sessionStorageKey = "farmadelivery.session";
type AdminView = "dashboard" | "delivery" | "map" | "queue" | "routes" | "reports" | "team" | "notifications";
type QueueSection = "dispatch" | "deliveries" | "history";
type RoutesSection = "planning" | "active";

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [sessionLoading, setSessionLoading] = useState(() => Boolean(readStoredSession()?.token));
  const [stores, setStores] = useState<StoreUnit[]>(fallbackStores);
  const [deliveries, setDeliveries] = useState<Delivery[]>(fallbackDeliveries);
  const [liveCouriers, setLiveCouriers] = useState(couriers);
  const [courierRoutes, setCourierRoutes] = useState<CourierRoute[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [selectedDeliveryEvents, setSelectedDeliveryEvents] = useState<DeliveryEvent[]>([]);
  const [selectedDeliveryProofs, setSelectedDeliveryProofs] = useState<DeliveryProof[]>([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [role, setRole] = useState<AccessRole>("admin");
  const [selectedStore, setSelectedStore] = useState(fallbackStores[0]?.name ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapStatusFilter, setMapStatusFilter] = useState<DeliveryStatus | "Todas">("Todas");
  const [dateFilter, setDateFilter] = useState(toDateInputValue(new Date()));
  const [reportDateRange, setReportDateRange] = useState(() => {
    const today = toDateInputValue(new Date());
    return { startsAt: today, endsAt: today };
  });
  const [storeSource, setStoreSource] = useState<"api" | "supabase" | "fallback">("fallback");
  const [storeLoadError, setStoreLoadError] = useState<string | null>(null);
  const [storesLoading, setStoresLoading] = useState(true);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);
  const [couriersLoading, setCouriersLoading] = useState(true);
  const [couriersError, setCouriersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [reportSummary, setReportSummary] = useState<DeliveryReportSummary | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [actionDeliveryId, setActionDeliveryId] = useState<string | null>(null);
  const [recalculatingRouteId, setRecalculatingRouteId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deliveryActionDialog, setDeliveryActionDialog] = useState<{
    mode: DeliveryActionDialogMode;
    delivery: Delivery;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const [queueSection, setQueueSection] = useState<QueueSection>("dispatch");
  const [routesSection, setRoutesSection] = useState<RoutesSection>("planning");
  const canUseAdminScope = session?.role === "ADMIN";
  const isAdmin = canUseAdminScope && role === "admin";

  useEffect(() => {
    setAuthToken(session?.token ?? null);
  }, [session?.token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(sessionStorageKey);
      setAuthToken(null);
      setSession(null);
      setToasts([]);
    };

    window.addEventListener("farmadelivery:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("farmadelivery:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    const storedSession = readStoredSession();
    if (!storedSession?.token) {
      setSessionLoading(false);
      return;
    }

    setAuthToken(storedSession.token);
    fetchCurrentSession(storedSession.token)
      .then((validatedSession) => {
        setSession(validatedSession);
        localStorage.setItem(sessionStorageKey, JSON.stringify(validatedSession));
      })
      .catch(() => {
        localStorage.removeItem(sessionStorageKey);
        setSession(null);
        setAuthToken(null);
      })
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    if (canUseAdminScope) {
      setRole("admin");
      return;
    }
    setRole("loja");
    if (session.store?.name) {
      setSelectedStore(session.store.name);
    }
  }, [canUseAdminScope, session]);

  useEffect(() => {
    if (!isAdmin && (activeView === "team" || activeView === "notifications")) {
      setActiveView("dashboard");
    }
  }, [activeView, isAdmin]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      pushToast({
        tone: "success",
        title: "Conexao restaurada",
        description: "O painel voltou a se comunicar com a rede.",
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      pushToast({
        tone: "error",
        title: "Sem conexao",
        description: "Algumas atualizacoes podem ficar indisponiveis ate a rede voltar.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function reloadStores() {
    setStoresLoading(true);
    try {
      const result = await fetchStoresWithSource();
      if (result.stores.length === 0) return;
      setStores(result.stores);
      setStoreSource(result.source);
      setStoreLoadError(null);
      setSelectedStore((current) =>
        result.stores.some((store) => store.name === current) ? current : result.stores[0].name,
      );
    } catch (error) {
      console.error("stores reload error", error);
      setStoreLoadError("Nao foi possivel atualizar as lojas agora.");
    } finally {
      setStoresLoading(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    let active = true;

    const loadStores = () => {
      setStoresLoading(true);
      fetchStoresWithSource()
      .then((result) => {
        if (!active || result.stores.length === 0) return;
        setStores(result.stores);
        setStoreSource(result.source);
        setStoreLoadError(null);
        setSelectedStore((current) =>
          result.stores.some((store) => store.name === current) ? current : result.stores[0].name,
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("stores load error", error);
        setStoreSource("fallback");
        setStoreLoadError("Nao foi possivel atualizar as lojas agora.");
      })
      .finally(() => {
        if (!active) return;
        setStoresLoading(false);
      });
    };

    loadStores();
    const unsubscribe = subscribeToStoreChanges(loadStores);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [session]);

  const reportStoreId = useMemo(
    () => (isAdmin ? undefined : stores.find((store) => store.name === selectedStore)?.id),
    [isAdmin, selectedStore, stores],
  );

  useEffect(() => {
    if (!session) return;
    let active = true;

    const loadCouriers = () => {
      setCouriersLoading(true);
      setCouriersError(null);
      fetchCouriers()
        .then((apiCouriers) => {
          if (!active) return;
          setLiveCouriers(apiCouriers);
        })
        .catch(() => {
          if (!active) return;
          setLiveCouriers(couriers);
          setCouriersError("Nao foi possivel atualizar a localizacao dos motoboys.");
        })
        .finally(() => {
          if (!active) return;
          setCouriersLoading(false);
        });
    };

    loadCouriers();
    const unsubscribeCouriers = subscribeToUserChanges(loadCouriers);

    return () => {
      active = false;
      unsubscribeCouriers();
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;

    const loadUsers = () => {
      setUsersLoading(true);
      setUsersError(null);
      fetchUsers()
        .then((apiUsers) => {
          if (!active) return;
          setUsers(apiUsers);
        })
        .catch(() => {
          if (!active) return;
          setUsers([]);
          setUsersError("Nao foi possivel atualizar a equipe.");
        })
        .finally(() => {
          if (!active) return;
          setUsersLoading(false);
        });
    };

    loadUsers();
    const unsubscribeUsers = subscribeToUserChanges(loadUsers);

    return () => {
      active = false;
      unsubscribeUsers();
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;

    const loadDeliveries = () => {
      setDeliveriesLoading(true);
      setDeliveriesError(null);
      fetchDeliveries()
        .then((apiDeliveries) => {
          if (!active) return;
          setDeliveries(apiDeliveries);
        })
        .catch(() => {
          if (!active) return;
          setDeliveries(fallbackDeliveries);
          setDeliveriesError("Nao foi possivel atualizar as entregas.");
        })
        .finally(() => {
          if (!active) return;
          setDeliveriesLoading(false);
        });
    };

    loadDeliveries();
    const unsubscribeDelivery = subscribeToDeliveryChanges(loadDeliveries);

    return () => {
      active = false;
      unsubscribeDelivery();
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;

    const loadCourierRoutes = () => {
      setRoutesLoading(true);
      setRoutesError(null);
      fetchCourierRoutes()
        .then((routes) => {
          if (!active) return;
          setCourierRoutes(routes);
        })
        .catch(() => {
          if (!active) return;
          setCourierRoutes([]);
          setRoutesError("Nao foi possivel atualizar as rotas dos motoboys.");
        })
        .finally(() => {
          if (!active) return;
          setRoutesLoading(false);
        });
    };

    loadCourierRoutes();
    const unsubscribeRoutes = subscribeToRouteChanges(loadCourierRoutes);

    return () => {
      active = false;
      unsubscribeRoutes();
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (!isAdmin && !reportStoreId) {
      setReportSummary(null);
      return;
    }

    let active = true;
    setReportError(null);
    fetchDeliveryReportSummary({ startsAt: reportDateRange.startsAt, endsAt: reportDateRange.endsAt, storeId: reportStoreId })
      .then((summary) => {
        if (!active) return;
        setReportSummary(summary);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("report summary error", error);
        setReportSummary(null);
        setReportError("Nao foi possivel atualizar o resumo do relatorio.");
      });

    return () => {
      active = false;
    };
  }, [deliveries, isAdmin, reportDateRange.endsAt, reportDateRange.startsAt, reportStoreId, session]);

  async function reloadDeliveries() {
    setDeliveriesLoading(true);
    setDeliveriesError(null);
    let loadedDeliveries: Delivery[] | null = null;
    try {
      const apiDeliveries = await fetchDeliveries();
      loadedDeliveries = apiDeliveries;
      setDeliveries(apiDeliveries);
      setCourierRoutes(await fetchCourierRoutes().catch(() => []));
    } catch (error) {
      console.error("deliveries reload error", error);
      setDeliveriesError("Nao foi possivel atualizar as entregas.");
    } finally {
      setDeliveriesLoading(false);
    }
    if (selectedDelivery) {
      const updatedDelivery = loadedDeliveries?.find((delivery) => delivery.id === selectedDelivery.id) ?? selectedDelivery;
      await loadDeliveryEvents(updatedDelivery);
    }
  }

  async function reloadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      setUsers(await fetchUsers());
    } catch (error) {
      console.error("users reload error", error);
      setUsersError("Nao foi possivel atualizar a equipe.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function reloadCourierRoutes() {
    setRoutesLoading(true);
    setRoutesError(null);
    try {
      setCourierRoutes(await fetchCourierRoutes());
    } catch (error) {
      console.error("courier routes reload error", error);
      setRoutesError("Nao foi possivel atualizar as rotas dos motoboys.");
      setCourierRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  }

  async function handleCancelDelivery(delivery: Delivery) {
    setDeliveryActionDialog({ mode: "cancel", delivery });
  }

  async function confirmCancelDelivery(delivery: Delivery, reason: string) {
    const completed = await runDeliveryAction(
      delivery.id,
      async () => {
        await cancelDelivery({
          deliveryId: delivery.id,
          reason,
          notifyCourier: true,
        });
        await reloadDeliveries();
      },
      {
        successTitle: "Entrega cancelada",
        successDescription: `${delivery.customer} foi removida da fila ativa.`,
      },
    );
    if (completed) setDeliveryActionDialog(null);
  }

  async function handleAcceptDelivery(delivery: Delivery, courierId: string) {
    await runDeliveryAction(delivery.id, async () => {
      await acceptDelivery({ deliveryId: delivery.id, courierId });
      await reloadDeliveries();
    }, {
      successTitle: "Entrega aceita",
      successDescription: `Entrega de ${delivery.customer} vinculada ao motoboy.`,
    });
  }

  async function handleCollectDelivery(delivery: Delivery) {
    await runDeliveryAction(delivery.id, async () => {
      await collectDelivery({ deliveryId: delivery.id });
      await reloadDeliveries();
    }, {
      successTitle: "Coleta registrada",
      successDescription: `${delivery.customer} saiu da etapa de aceite.`,
    });
  }

  async function handleStartRoute(delivery: Delivery) {
    await runDeliveryAction(delivery.id, async () => {
      await startDeliveryRoute({ deliveryId: delivery.id });
      await reloadDeliveries();
    }, {
      successTitle: "Rota iniciada",
      successDescription: `Entrega de ${delivery.customer} marcada em rota.`,
    });
  }

  async function handleCompleteDelivery(delivery: Delivery) {
    setDeliveryActionDialog({ mode: "complete", delivery });
  }

  async function confirmCompleteDelivery(delivery: Delivery, notes: string) {
    const completed = await runDeliveryAction(
      delivery.id,
      async () => {
        await completeDelivery({ deliveryId: delivery.id, notes });
        await reloadDeliveries();
      },
      {
        successTitle: "Entrega concluida",
        successDescription: `${delivery.customer} foi marcada como entregue.`,
      },
    );
    if (completed) setDeliveryActionDialog(null);
  }

  async function handleDeliveryProblem(delivery: Delivery) {
    setDeliveryActionDialog({ mode: "problem", delivery });
  }

  async function confirmDeliveryProblem(delivery: Delivery, notes: string) {
    const completed = await runDeliveryAction(
      delivery.id,
      async () => {
        await registerDeliveryProblem({ deliveryId: delivery.id, notes });
        await reloadDeliveries();
      },
      {
        successTitle: "Ocorrencia registrada",
        successDescription: `Problema salvo no historico da entrega.`,
      },
    );
    if (completed) setDeliveryActionDialog(null);
  }

  async function handleRecalculateRoute(route: CourierRoute) {
    setRecalculatingRouteId(route.id);
    const toastId = pushToast({
      tone: "loading",
      title: "Recalculando rota",
      description: route.courier.name,
    });
    try {
      await recalculateCourierRoute(route.id);
      await reloadCourierRoutes();
      replaceToast(toastId, {
        tone: "success",
        title: "Rota recalculada",
        description: `Sequencia atualizada para ${route.courier.name}.`,
      });
    } catch (error) {
      replaceToast(toastId, {
        tone: "error",
        title: "Nao foi possivel recalcular",
        description: userFacingError(error, "A rota nao foi recalculada agora. Tente novamente em instantes."),
      });
    } finally {
      setRecalculatingRouteId(null);
    }
  }

  async function runDeliveryAction(
    deliveryId: string,
    action: () => Promise<void>,
    messages: { successTitle: string; successDescription?: string },
  ) {
    setActionDeliveryId(deliveryId);
    const toastId = pushToast({
      tone: "loading",
      title: "Atualizando entrega",
      description: "Salvando alteracao da entrega.",
    });
    try {
      await action();
      replaceToast(toastId, {
        tone: "success",
        title: messages.successTitle,
        description: messages.successDescription,
      });
      return true;
    } catch (error) {
      replaceToast(toastId, {
        tone: "error",
        title: "Acao nao concluida",
        description: userFacingError(error, "Nao foi possivel concluir a acao agora. Tente novamente."),
      });
      return false;
    } finally {
      setActionDeliveryId(null);
    }
  }

  function pushToast(message: Omit<ToastMessage, "id">) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-3), { ...message, id }]);
    if (message.tone !== "loading") {
      window.setTimeout(() => dismissToast(id), 5200);
    }
    return id;
  }

  function replaceToast(id: string, message: Omit<ToastMessage, "id">) {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...message, id } : toast)));
    if (message.tone !== "loading") {
      window.setTimeout(() => dismissToast(id), 5200);
    }
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function handleAuthenticated(nextSession: AuthSession) {
    setSession(nextSession);
    setAuthToken(nextSession.token);
    localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    pushToast({
      tone: "success",
      title: "Sessao iniciada",
      description: `Bem-vindo, ${nextSession.name}.`,
    });
  }

  function handleLogout() {
    localStorage.removeItem(sessionStorageKey);
    setAuthToken(null);
    setSession(null);
    setToasts([]);
  }

  async function loadDeliveryEvents(delivery: Delivery) {
    setSelectedDelivery(delivery);
    setEventLoading(true);
    setEventError(null);
    try {
      const [events, proofs] = await Promise.all([fetchDeliveryEvents(delivery.id), fetchDeliveryProofs(delivery.id)]);
      setSelectedDeliveryEvents(events);
      setSelectedDeliveryProofs(proofs);
    } catch (error) {
      console.error("delivery history load error", error);
      setSelectedDeliveryEvents([]);
      setSelectedDeliveryProofs([]);
      setEventError("Nao foi possivel carregar o historico desta entrega.");
    } finally {
      setEventLoading(false);
    }
  }

  const visibleStores = useMemo(
    () => (isAdmin ? stores : stores.filter((store) => store.name === selectedStore)),
    [isAdmin, selectedStore],
  );
  const visibleDeliveries = useMemo(
    () =>
      (isAdmin ? deliveries : deliveries.filter((delivery) => delivery.store === selectedStore)).filter((delivery) =>
        deliveryMatchesSearch(delivery, searchQuery),
      ),
    [deliveries, isAdmin, searchQuery, selectedStore],
  );
  const visibleDeliveriesForDate = useMemo(
    () => visibleDeliveries.filter((delivery) => deliveryMatchesDate(delivery, dateFilter)),
    [visibleDeliveries, dateFilter],
  );
  const visibleDeliveriesForReport = useMemo(
    () => visibleDeliveries.filter((delivery) => deliveryMatchesReportDateRange(delivery, reportDateRange)),
    [reportDateRange, visibleDeliveries],
  );
  const reportLabel = reportDateLabel(reportDateRange);
  const mapDeliveries = useMemo(
    () =>
      visibleDeliveriesForDate.filter((delivery) =>
        mapStatusFilter === "Todas" ? true : delivery.status === mapStatusFilter,
      ),
    [mapStatusFilter, visibleDeliveriesForDate],
  );
  const visibleCouriers = useMemo(
    () => (isAdmin ? liveCouriers : liveCouriers.filter((courier) => courier.store.includes(selectedStore))),
    [isAdmin, liveCouriers, selectedStore],
  );
  const visibleCourierRoutes = useMemo(
    () =>
      isAdmin
        ? courierRoutes
        : courierRoutes.filter((route) => normalizeText(route.courier.baseStoreName).includes(normalizeText(selectedStore))),
    [courierRoutes, isAdmin, selectedStore],
  );

  const pendingCount = visibleDeliveriesForDate.filter((delivery) => delivery.status === "Aguardando").length;
  const routeCount = visibleDeliveriesForDate.filter((delivery) => delivery.status === "Em rota").length;
  const issueCount = visibleDeliveriesForDate.filter((delivery) => delivery.status === "Problema").length;
  const overdueCount = visibleDeliveriesForDate.filter(isDeliveryOverdue).length;
  const routeableDeliveries = visibleDeliveriesForDate.filter((delivery) => delivery.status === "Aguardando");
  const deliveredTodayCount = visibleDeliveriesForDate.filter((delivery) => delivery.status === "Entregue").length;
  const metricScope = isAdmin ? "todas as lojas" : selectedStore;
  const statusSummary = deliveryStatuses.map((status) => ({
    status,
    count: visibleDeliveriesForDate.filter((delivery) => delivery.status === status).length,
  }));
  const navItems = [
    { view: "dashboard" as const, label: "Painel", icon: <BarChart3 size={18} /> },
    { view: "delivery" as const, label: "Nova entrega", icon: <Plus size={18} /> },
    { view: "map" as const, label: "Mapa", icon: <MapPin size={18} /> },
    { view: "queue" as const, label: "Fila", icon: <ClipboardList size={18} /> },
    { view: "routes" as const, label: "Rotas", icon: <Bike size={18} /> },
    { view: "reports" as const, label: "Relatorios", icon: <ClipboardList size={18} /> },
    ...(isAdmin
      ? [
          { view: "team" as const, label: "Equipe e lojas", icon: <Users size={18} /> },
          { view: "notifications" as const, label: "Avisos", icon: <Bell size={18} /> },
        ]
      : []),
  ];
  const activeNavItem = navItems.find((item) => item.view === activeView) ?? navItems[0];
  const pageTitle = activeView === "dashboard" ? (isAdmin ? "Visao geral das entregas" : `Operacao ${selectedStore}`) : activeNavItem.label;
  const pageEyebrow = isAdmin ? "Painel admin" : `Painel da loja ${selectedStore}`;
  const activeViewContent = (() => {
    switch (activeView) {
      case "delivery":
        return (
          <section className="singlePanel" aria-label="Cadastro de entrega">
            <DeliveryForm stores={visibleStores} redirectStores={stores} attendants={users} onCreated={reloadDeliveries} />
          </section>
        );
      case "map":
        return (
          <OperationsMap
            stores={visibleStores}
            couriers={visibleCouriers}
            deliveries={mapDeliveries}
            courierRoutes={visibleCourierRoutes}
            statusFilter={mapStatusFilter}
            dateFilter={dateFilter}
            loading={storesLoading || deliveriesLoading || couriersLoading || routesLoading}
            error={storeLoadError || deliveriesError || couriersError || routesError}
            onStatusFilterChange={setMapStatusFilter}
            onDateFilterChange={setDateFilter}
          />
        );
      case "queue":
        return (
          <section className="dedicatedStack">
            <section className="tablePanel">
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">{isAdmin ? "Fila geral" : "Fila da loja"}</span>
                  <h2>
                    {queueSection === "dispatch"
                      ? "Despacho de entregas"
                      : queueSection === "history"
                        ? "Historico da entrega"
                        : isAdmin
                          ? "Entregas recentes"
                          : `Entregas ${selectedStore}`}
                  </h2>
                </div>
                <div className="statusSummary" aria-label="Resumo por status">
                  {statusSummary.map((item) => (
                    <span key={item.status}>
                      {item.status}: {item.count}
                    </span>
                  ))}
                </div>
              </div>

              <div className="sectionTabs" aria-label="Categorias da fila">
                <button className={queueSection === "dispatch" ? "selected" : ""} type="button" onClick={() => setQueueSection("dispatch")}>
                  Despacho
                </button>
                <button className={queueSection === "deliveries" ? "selected" : ""} type="button" onClick={() => setQueueSection("deliveries")}>
                  Entregas
                </button>
                <button className={queueSection === "history" ? "selected" : ""} type="button" onClick={() => setQueueSection("history")}>
                  Historico
                </button>
              </div>

              {queueSection === "dispatch" ? (
                <RouteBoard
                  deliveries={routeableDeliveries}
                  stores={visibleStores}
                  loading={deliveriesLoading || storesLoading}
                  error={deliveriesError || storeLoadError}
                />
              ) : null}

              {queueSection === "deliveries" ? (
                <DeliveryTable
                  deliveries={visibleDeliveriesForDate}
                  couriers={users}
                  loading={deliveriesLoading}
                  error={deliveriesError}
                  actionDeliveryId={actionDeliveryId}
                  onRetry={reloadDeliveries}
                  onAccept={handleAcceptDelivery}
                  onCollect={handleCollectDelivery}
                  onStartRoute={handleStartRoute}
                  onComplete={handleCompleteDelivery}
                  onProblem={handleDeliveryProblem}
                  onCancel={handleCancelDelivery}
                  onShowHistory={(delivery) => {
                    setQueueSection("history");
                    void loadDeliveryEvents(delivery);
                  }}
                />
              ) : null}

              {queueSection === "history" ? (
                <DeliveryEventPanel
                  delivery={selectedDelivery}
                  events={selectedDeliveryEvents}
                  proofs={selectedDeliveryProofs}
                  loading={eventLoading}
                  error={eventError}
                />
              ) : null}
            </section>
          </section>
        );
      case "routes":
        return (
          <section className="dedicatedStack">
            <section className="tablePanel" aria-label="Categorias de rotas">
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">Rotas</span>
                  <h2>{routesSection === "planning" ? "Planejamento de rota" : "Rotas em operacao"}</h2>
                </div>
              </div>
              <div className="sectionTabs" aria-label="Categorias de rotas">
                <button className={routesSection === "planning" ? "selected" : ""} type="button" onClick={() => setRoutesSection("planning")}>
                  Planejamento
                </button>
                <button className={routesSection === "active" ? "selected" : ""} type="button" onClick={() => setRoutesSection("active")}>
                  Acompanhamento
                </button>
              </div>
            </section>
            {routesSection === "planning" ? (
              <RouteStrategyPanel stores={visibleStores} selectedStoreName={selectedStore} isAdmin={isAdmin} />
            ) : (
              <CourierRoutesPanel
                routes={visibleCourierRoutes}
                loading={routesLoading}
                error={routesError}
                recalculatingRouteId={recalculatingRouteId}
                onRetry={reloadCourierRoutes}
                onRecalculate={handleRecalculateRoute}
              />
            )}
          </section>
        );
      case "reports":
        return (
          <ReportsPanel
            deliveries={visibleDeliveriesForReport}
            stores={visibleStores}
            scopeLabel={metricScope}
            dateLabel={reportLabel}
            dateRange={reportDateRange}
            summary={reportSummary}
            loading={deliveriesLoading || storesLoading}
            error={deliveriesError}
            storeId={reportStoreId}
            onDateRangeChange={setReportDateRange}
          />
        );
      case "team":
        return isAdmin ? (
          <ManagementPanel
            stores={stores}
            users={users}
            usersLoading={usersLoading}
            usersError={usersError}
            onUserCreated={reloadUsers}
            onStoreChanged={reloadStores}
          />
        ) : null;
      case "notifications":
        return isAdmin ? <NotificationMonitorPanel /> : null;
      case "dashboard":
      default:
        return (
          <section className="dedicatedStack">
            <section className="metrics" aria-label="Resumo da operacao">
              <Metric icon={<Clock3 size={20} />} label={`Aguardando - ${metricScope}`} value={pendingCount} tone="amber" />
              <Metric icon={<Bike size={20} />} label={`Em rota - ${metricScope}`} value={routeCount} tone="green" />
              <Metric icon={<AlertTriangle size={20} />} label={`Ocorrencias - ${metricScope}`} value={issueCount} tone="red" />
              <Metric icon={<AlertTriangle size={20} />} label={`SLA atrasado - ${metricScope}`} value={overdueCount} tone="red" />
              <Metric icon={<CheckCircle2 size={20} />} label={`Entregues - ${metricScope}`} value={deliveredTodayCount} tone="blue" />
            </section>
            <DeliveryAnalytics
              deliveries={visibleDeliveriesForDate}
              stores={visibleStores}
              scopeLabel={metricScope}
              loading={deliveriesLoading || storesLoading}
              error={deliveriesError}
            />
            <StoreVolume
              stores={visibleStores}
              title={isAdmin ? "Volume por loja" : "Unidade logada"}
              loading={storesLoading}
              error={storeLoadError}
            />
          </section>
        );
    }
  })();

  if (sessionLoading) {
    return (
      <main className="loginShell">
        <section className="loginCard">
          <div className="stateBlock loading">
            <strong>Validando sessao</strong>
            <p>Conferindo seu acesso salvo antes de abrir o painel.</p>
            <div className="loadingBars" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <main className="shell">
      <ToastStack messages={toasts} onDismiss={dismissToast} />
      <DeliveryActionDialog
        delivery={deliveryActionDialog?.delivery ?? null}
        mode={deliveryActionDialog?.mode ?? null}
        loading={deliveryActionDialog ? actionDeliveryId === deliveryActionDialog.delivery.id : false}
        onClose={() => setDeliveryActionDialog(null)}
        onConfirm={(notes) => {
          if (!deliveryActionDialog) return;
          if (deliveryActionDialog.mode === "cancel") {
            void confirmCancelDelivery(deliveryActionDialog.delivery, notes);
          } else if (deliveryActionDialog.mode === "complete") {
            void confirmCompleteDelivery(deliveryActionDialog.delivery, notes);
          } else {
            void confirmDeliveryProblem(deliveryActionDialog.delivery, notes);
          }
        }}
      />
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="brand">
          <div className="brandMark">
            <img src="/assets/drogaria-santo-antonio-logo.png" alt="Drogaria Santo Antonio" />
          </div>
          <div>
            <strong>FarmaDelivery</strong>
            <span>Drogaria Santo Antonio</span>
          </div>
        </div>

        <nav className="navList">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={`navItem${activeView === item.view ? " active" : ""}`}
              type="button"
              onClick={() => setActiveView(item.view)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebarPanel">
          <span className="panelLabel">Base principal</span>
          <strong>Asturias</strong>
          <small>Atende lojas 1 a 4 com fila compartilhada.</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{pageEyebrow}</span>
            <h1>{pageTitle}</h1>
          </div>

          <div className="topActions">
            <label className="searchBox">
              <Search size={17} />
              <input
                placeholder="Buscar telefone, cliente ou entrega"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <button className="primaryButton" type="button" onClick={() => setActiveView("delivery")}>
              <Plus size={18} /> Nova entrega
            </button>
            <button className="secondaryButton" type="button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>

        <AccessScopePanel
          role={role}
          selectedStore={selectedStore}
          stores={stores}
          canUseAdminScope={canUseAdminScope}
          currentUser={session}
          onRoleChange={setRole}
          onStoreChange={setSelectedStore}
        />

        {storeLoadError ? (
          <div className="dataBanner">
            Algumas informacoes podem estar desatualizadas. {storeLoadError}
          </div>
        ) : !isOnline ? (
          <div className="dataBanner">Sem conexao no navegador. O painel mostra o ultimo estado carregado.</div>
        ) : null}

        <section className="viewPane" aria-live="polite">
          {activeViewContent}
        </section>
      </section>
    </main>
  );
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function deliveryMatchesDate(delivery: Delivery, dateFilter: string) {
  if (!dateFilter) return true;
  const timestamps = [
    delivery.rawCreatedAt,
    delivery.rawDispatchedAt,
    delivery.rawCollectedAt,
    delivery.rawDeliveredAt,
    delivery.rawCanceledAt,
  ].filter(Boolean) as string[];

  return timestamps.some((timestamp) => toDateInputValue(new Date(timestamp)) === dateFilter);
}

function deliveryMatchesSearch(delivery: Delivery, searchQuery: string) {
  const query = normalizeText(searchQuery);
  if (!query) return true;
  return [
    delivery.id,
    delivery.store,
    delivery.customer,
    delivery.phone,
    delivery.address,
    delivery.status,
    delivery.courier,
  ].some((value) => normalizeText(value).includes(query));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function readStoredSession() {
  try {
    const stored = localStorage.getItem(sessionStorageKey);
    return stored ? (JSON.parse(stored) as AuthSession) : null;
  } catch {
    localStorage.removeItem(sessionStorageKey);
    return null;
  }
}
