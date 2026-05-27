import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Clock3,
  LogOut,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  Send,
  Truck,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acceptDelivery,
  collectDelivery,
  completeDelivery,
  fetchCourierRoutes,
  fetchCurrentSession,
  fetchDeliveries,
  fetchDeliveryEvents,
  login,
  registerCourierDeviceToken,
  registerDeliveryProblem,
  setAuthToken,
  startDeliveryRoute,
  subscribeToLiveEvents,
  updateAvailability,
  updateLocation,
  uploadDeliveryProof,
} from "./api";
import { deliveryCardDateLabel } from "./deliveryCardDateLabels";
import { deliveryCompletionInput } from "./deliveryCompletion";
import { deliveryDailyNumberLabel, deliveryPrimaryCodeLabel } from "./deliveryDisplayCode";
import { deliveryEventActorLabel } from "./deliveryEventActors";
import { deliveryEventTypeLabel } from "./deliveryEventLabels";
import { deliveryEventNotesText } from "./deliveryEventNotes";
import { deliveryEventTimestampLabel } from "./deliveryEventTimestamps";
import { deliveryMapSearchUrl } from "./deliveryMapLinks";
import { deliveryPriorityLabel } from "./deliveryPriorityLabels";
import { deliverySections } from "./deliverySections";
import { deliveryStatusLabel } from "./deliveryStatusLabels";
import { prepareProofUpload } from "./deliveryProofImage";
import { getFirebaseWebPushToken } from "./firebase";
import { lastSyncLabel } from "./lastSyncLabel";
import {
  automaticLocationActionLabel,
  availabilityActionLabel,
  availabilityShortActionLabel,
} from "./locationActionLabels";
import { motoboyOperationalStatus } from "./motoboyOperationalStatus";
import {
  canTrackOpenAppLocation,
  shouldSendTrackedLocation,
  summarizeOperationalChangesForAvailability,
} from "./operationalSignals";
import { phoneDialUrl } from "./phoneDialLinks";
import {
  activeRoutesWithPendingStops,
  buildRouteMapsSegment,
  routeMapsLinkLabel,
  routeMapsUnavailableText,
  routeSegmentNoticeText,
} from "./routeNavigation";
import { routeStatusLabel } from "./routeStatusLabels";
import { routeStopDetails, routeStopTitle } from "./routeStopDisplay";
import { routeStopScheduleLabel } from "./routeStopScheduleLabels";
import {
  COURIER_SERVICE_AREAS,
  courierServiceAreaLabel,
  courierServiceAreaSummary,
  normalizeCourierServiceArea,
  type CourierServiceArea,
} from "./serviceAreas";
import type { AuthSession, CourierRoute, Delivery, DeliveryEvent } from "./types";
import { userFacingError } from "./userMessages";

const TOKEN_KEY = "farmadelivery.motoboy.token";
const TRACKING_KEY = "farmadelivery.motoboy.tracking";
const AUTO_REFRESH_KEY = "farmadelivery.motoboy.autoRefresh";
const AVAILABILITY_KEY = "farmadelivery.motoboy.available";
const SERVICE_AREA_KEY = "farmadelivery.motoboy.serviceArea";
const WEB_PUSH_TOKEN_KEY = "farmadelivery.motoboy.webPushToken";
const FIREBASE_WEB_PUSH_VAPID_KEY = import.meta.env.VITE_FIREBASE_WEB_PUSH_VAPID_KEY;
const MOTOBOY_AUTO_REFRESH_INTERVAL_MS = 10000;
const LOCATION_FORCE_SEND_INTERVAL_MS = 30000;
const LOCATION_STALE_WARNING_MS = 90000;

type View = "deliveries" | "route";
type DeliveryListSection = "available" | "active";
type BusyAction = string | null;

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [routes, setRoutes] = useState<CourierRoute[]>([]);
  const [eventsByDelivery, setEventsByDelivery] = useState<Record<string, DeliveryEvent[]>>({});
  const [view, setView] = useState<View>("deliveries");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [available, setAvailable] = useState(false);
  const [inDeliveryOperation, setInDeliveryOperation] = useState(false);
  const [serviceArea, setServiceArea] = useState<CourierServiceArea>(() =>
    normalizeCourierServiceArea(localStorage.getItem(SERVICE_AREA_KEY)),
  );
  const [trackingEnabled, setTrackingEnabled] = useState(() => localStorage.getItem(TRACKING_KEY) === "true");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => localStorage.getItem(AUTO_REFRESH_KEY) !== "false");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [lastLocationSentAt, setLastLocationSentAt] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastTrackedLocationRef = useRef<{ latitude: number; longitude: number; sentAt: number } | null>(null);
  const deliveriesRef = useRef<Delivery[]>([]);
  const hasLoadedOperationalDataRef = useRef(false);

  const courierId = session?.courier?.id ?? null;

  const loadOperationalData = useCallback(async (silent = false) => {
    if (!session) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [nextDeliveries, nextRoutes] = await Promise.all([fetchDeliveries(serviceArea), fetchCourierRoutes()]);
      const notification = summarizeOperationalChangesForAvailability(
        deliveriesRef.current,
        nextDeliveries,
        available,
        hasLoadedOperationalDataRef.current,
      );
      if (silent && notification) {
        setNotice(notification.body);
        showLocalNotification(notification.title, notification.body);
      }
      deliveriesRef.current = nextDeliveries;
      hasLoadedOperationalDataRef.current = true;
      setDeliveries(nextDeliveries);
      setRoutes(nextRoutes);
      setLastSyncedAt(new Date());
    } catch (err) {
      if (!silent) setError(messageFrom(err, "Nao foi possivel carregar entregas e rotas agora."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [available, serviceArea, session]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setCheckingSession(false);
      return;
    }

    setAuthToken(token);
    fetchCurrentSession(token)
      .then(async (nextSession) => {
        if (nextSession.role !== "MOTOBOY") {
          throw new Error("Este acesso e exclusivo para motoboys.");
        }
        const nextServiceArea = normalizeCourierServiceArea(nextSession.courier?.preferredServiceArea ?? localStorage.getItem(SERVICE_AREA_KEY));
        setServiceArea(nextServiceArea);
        localStorage.setItem(SERVICE_AREA_KEY, nextServiceArea);
        const nextAvailable = await preferredAvailability(nextSession, nextServiceArea);
        setAvailable(nextAvailable);
        syncCourierAvailabilityWithServiceWorker(nextAvailable);
        void requestLocationPermission();
        setOpenAppTracking(nextAvailable);
        setSession(nextSession);
      })
      .catch(() => {
        clearLocalSession();
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    void loadOperationalData();
  }, [loadOperationalData]);

  useEffect(() => {
    if (!session || !courierId || !FIREBASE_WEB_PUSH_VAPID_KEY) return;

    getFirebaseWebPushToken(FIREBASE_WEB_PUSH_VAPID_KEY)
      .then(async (deviceToken) => {
        if (!deviceToken || localStorage.getItem(WEB_PUSH_TOKEN_KEY) === deviceToken) return;
        await registerCourierDeviceToken({
          courierId,
          deviceToken,
          platform: "web",
        });
        localStorage.setItem(WEB_PUSH_TOKEN_KEY, deviceToken);
      })
      .catch(() => {
        // Web Push is best-effort on the PWA and depends on browser/install support.
      });
  }, [courierId, session]);

  useEffect(() => {
    syncCourierAvailabilityWithServiceWorker(available);
  }, [available]);

  useEffect(() => {
    if (!session || !autoRefreshEnabled) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadOperationalData(true);
      }
    }, MOTOBOY_AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled, loadOperationalData, session]);

  useEffect(() => {
    if (!session) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    return subscribeToLiveEvents(token, (type) => {
      if (type === "deliveries" || type === "routes") {
        void loadOperationalData(true);
      }
    });
  }, [loadOperationalData, session]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearLocalSession("Sessao expirada. Entre novamente.");
    };
    window.addEventListener("farmadelivery:unauthorized", onUnauthorized);
    return () => window.removeEventListener("farmadelivery:unauthorized", onUnauthorized);
  }, []);

  const sections = useMemo(() => deliverySections(deliveries), [deliveries]);
  const operationallyActive = available || sections.active.length > 0 || inDeliveryOperation;

  useEffect(() => {
    if (available || sections.active.length > 0 || !inDeliveryOperation || loading) return;
    setInDeliveryOperation(false);
    setOpenAppTracking(false);
  }, [available, inDeliveryOperation, loading, sections.active.length]);

  useEffect(() => {
    if (
      !canTrackOpenAppLocation({
        hasSession: Boolean(session),
        hasCourier: Boolean(courierId),
        trackingEnabled,
        operationallyActive,
      })
    ) {
      stopOpenAppTracking(watchIdRef);
      return;
    }

    if (!navigator.geolocation) {
      setTrackingEnabled(false);
      localStorage.removeItem(TRACKING_KEY);
      setError("Este iPhone nao liberou geolocalizacao no navegador.");
      return;
    }

    const activeCourierId = courierId;
    if (!activeCourierId) return;

    const sendTrackedPosition = (position: GeolocationPosition, force = false) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      if (!force && !shouldSendTrackedLocation(lastTrackedLocationRef.current, latitude, longitude)) return;

      updateLocation({
        courierId: activeCourierId,
        latitude,
        longitude,
        serviceArea,
      })
        .then(() => {
          const sentAt = Date.now();
          lastTrackedLocationRef.current = { latitude, longitude, sentAt };
          setLastLocationSentAt(new Date(sentAt));
        })
        .catch((err) => setError(messageFrom(err, "Nao consegui enviar sua localizacao ao vivo agora.")));
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => sendTrackedPosition(position),
      () => {
        setTrackingEnabled(false);
        localStorage.removeItem(TRACKING_KEY);
        setError("GPS ao vivo desligado. Confira a permissao de localizacao do Safari.");
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );

    const forcedInterval = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => sendTrackedPosition(position, true),
        () => setError("Nao consegui atualizar o GPS ao vivo. Confira a permissao de localizacao."),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
      );
    }, LOCATION_FORCE_SEND_INTERVAL_MS);

    return () => {
      window.clearInterval(forcedInterval);
      stopOpenAppTracking(watchIdRef);
    };
  }, [courierId, operationallyActive, serviceArea, session, trackingEnabled]);

  async function handleLogin(input: { identifier: string; password: string }) {
    setError(null);
    const nextSession = await login(input);
    if (nextSession.role !== "MOTOBOY") {
      throw new Error("Este acesso e exclusivo para motoboys.");
    }

    localStorage.setItem(TOKEN_KEY, nextSession.token);
    setAuthToken(nextSession.token);
    const nextServiceArea = normalizeCourierServiceArea(nextSession.courier?.preferredServiceArea ?? localStorage.getItem(SERVICE_AREA_KEY));
    setServiceArea(nextServiceArea);
    localStorage.setItem(SERVICE_AREA_KEY, nextServiceArea);
    const nextAvailable = await preferredAvailability(nextSession, nextServiceArea);
    setAvailable(nextAvailable);
    syncCourierAvailabilityWithServiceWorker(nextAvailable);
    void requestLocationPermission();
    setOpenAppTracking(nextAvailable);
    setSession(nextSession);
  }

  async function logout() {
    if (courierId) {
      await updateAvailability({ courierId, available: false, serviceArea }).catch(() => undefined);
    }
    clearLocalSession();
  }

  function clearLocalSession(message?: string) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TRACKING_KEY);
    localStorage.removeItem(WEB_PUSH_TOKEN_KEY);
    setAuthToken(null);
    setSession(null);
    setAvailable(false);
    setInDeliveryOperation(false);
    syncCourierAvailabilityWithServiceWorker(false);
    setTrackingEnabled(false);
    stopOpenAppTracking(watchIdRef);
    setDeliveries([]);
    deliveriesRef.current = [];
    hasLoadedOperationalDataRef.current = false;
    lastTrackedLocationRef.current = null;
    setLastLocationSentAt(null);
    setRoutes([]);
    setEventsByDelivery({});
    setLastSyncedAt(null);
    setBusyAction(null);
    setNotice(null);
    setError(message ?? null);
  }

  async function runAction(label: string, run: () => Promise<unknown>, successMessage = "Acao registrada com sucesso.") {
    setBusyAction(label);
    setError(null);
    setNotice(null);
    try {
      await run();
      setNotice(successMessage);
      await loadOperationalData();
    } catch (err) {
      setError(messageFrom(err, "Nao foi possivel registrar a acao agora."));
    } finally {
      setBusyAction(null);
    }
  }

  function invalidateDeliveryEvents(deliveryId: string) {
    setEventsByDelivery((current) => {
      if (!(deliveryId in current)) return current;
      const next = { ...current };
      delete next[deliveryId];
      return next;
    });
  }

  function toggleOpenAppTracking() {
    if (!operationallyActive) {
      setNotice("Comece as corridas ou mantenha uma entrega em atendimento para ligar o GPS ao vivo.");
      return;
    }
    const nextValue = !trackingEnabled;
    setTrackingEnabled(nextValue);
    if (nextValue) {
      localStorage.setItem(TRACKING_KEY, "true");
      setNotice("GPS ao vivo ligado enquanto o app estiver aberto.");
    } else {
      localStorage.removeItem(TRACKING_KEY);
      stopOpenAppTracking(watchIdRef);
      setNotice("GPS ao vivo desligado.");
    }
  }

  async function toggleAvailability() {
    if (!courierId) {
      setError("Seu usuario nao tem motoboy vinculado.");
      return;
    }

    const nextAvailable = !available;
    setBusyAction("availability");
    setError(null);
    setNotice(null);
    try {
      const courier = await updateAvailability({ courierId, available: nextAvailable, serviceArea });
      const updatedAvailable = Boolean(courier?.available);
      setAvailable(updatedAvailable);
      localStorage.setItem(AVAILABILITY_KEY, String(updatedAvailable));
      syncCourierAvailabilityWithServiceWorker(updatedAvailable);
      if (updatedAvailable) {
        void requestLocationPermission();
      }
      setOpenAppTracking(updatedAvailable);
      if (!updatedAvailable) {
        stopOpenAppTracking(watchIdRef);
      }
      setNotice(
        updatedAvailable
          ? "Corridas ligadas. As novas entregas vao aparecer aqui."
          : "Corridas paradas. Voce nao recebera novas entregas.",
      );
    } catch (err) {
      setError(messageFrom(err, "Nao consegui mudar seu status agora."));
    } finally {
      setBusyAction(null);
    }
  }

  function setOpenAppTracking(enabled: boolean) {
    setTrackingEnabled(enabled);
    if (enabled) {
      localStorage.setItem(TRACKING_KEY, "true");
    } else {
      localStorage.removeItem(TRACKING_KEY);
    }
  }

  async function toggleAutoRefresh() {
    const nextValue = !autoRefreshEnabled;
    setAutoRefreshEnabled(nextValue);
    if (nextValue) {
      localStorage.removeItem(AUTO_REFRESH_KEY);
      await requestNotificationPermission();
      setNotice("Atualizacao automatica ativa enquanto o PWA estiver aberto.");
      void loadOperationalData(true);
    } else {
      localStorage.setItem(AUTO_REFRESH_KEY, "false");
      setNotice("Atualizacao automatica pausada.");
    }
  }

  async function selectServiceArea(nextServiceArea: CourierServiceArea) {
    setServiceArea(nextServiceArea);
    localStorage.setItem(SERVICE_AREA_KEY, nextServiceArea);
    deliveriesRef.current = [];
    hasLoadedOperationalDataRef.current = false;
    setDeliveries([]);
    setNotice(`${courierServiceAreaLabel(nextServiceArea)} selecionada.`);
    if (!courierId) return;

    try {
      await updateAvailability({ courierId, available, serviceArea: nextServiceArea });
    } catch (err) {
      setError(messageFrom(err, "Nao foi possivel salvar a praca escolhida agora."));
    }
  }

  if (checkingSession) {
    return <Splash />;
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} error={error} />;
  }

  const operationalStatus = motoboyOperationalStatus({ available, trackingEnabled });
  const syncLabel = lastSyncLabel(lastSyncedAt);

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="topIdentity">
          <img src="/assets/drogaria-santo-antonio-logo.png" alt="Drogaria Santo Antonio" />
          <div>
            <span className="eyebrow">FarmaDelivery</span>
            <h1>{session.name}</h1>
            <p>{session.courier?.baseStoreName ?? "Motoboy"}</p>
          </div>
        </div>
        <button className="iconButton" type="button" onClick={logout} aria-label="Sair">
          <LogOut size={20} />
        </button>
      </header>

      <section className="statusSummary" aria-label="Resumo das entregas do motoboy">
        <div>
          <strong>{sections.available.length}</strong>
          <span>disponiveis</span>
        </div>
        <div>
          <strong>{sections.active.length}</strong>
          <span>em atendimento</span>
        </div>
      </section>

      <section className={`operationStatus ${operationalStatus.tone}`} aria-label="Situacao do motoboy">
        <div>
          <span>Situacao agora</span>
          <strong>{operationalStatus.title}</strong>
        </div>
        <p>{locationWatchText({ fallback: operationalStatus.text, trackingEnabled, operationallyActive, lastLocationSentAt })}</p>
      </section>

      <section className="serviceAreaSelector" aria-label="Praca de atendimento">
        <div>
          <span>Praca de atendimento</span>
          <strong>{courierServiceAreaLabel(serviceArea)}</strong>
          <p>{courierServiceAreaSummary(serviceArea)}</p>
        </div>
        <div className="serviceAreaButtons">
          {COURIER_SERVICE_AREAS.map((area) => (
            <button
              className={serviceArea === area ? "active" : ""}
              key={area}
              type="button"
              onClick={() => void selectServiceArea(area)}
            >
              {courierServiceAreaLabel(area).replace("Praca ", "")}
            </button>
          ))}
        </div>
      </section>

      <section className="statusActions" aria-label="Acoes de corridas e localizacao">
        <button
          aria-label={availabilityActionLabel(available)}
          className={available ? "availableOn" : ""}
          type="button"
          onClick={toggleAvailability}
          disabled={busyAction === "availability"}
        >
          <CheckCircle2 size={18} />
          {availabilityShortActionLabel()}
        </button>
        <button className={trackingEnabled ? "trackingOn" : ""} type="button" onClick={toggleOpenAppTracking} disabled={!operationallyActive}>
          <Navigation size={18} />
          {automaticLocationActionLabel(trackingEnabled)}
        </button>
      </section>

      {!available ? (
        <Banner
          tone="danger"
          text="Corridas paradas. Toque em Comecar corridas para receber novas entregas."
        />
      ) : null}

      <section className="liveControls">
        <button className={autoRefreshEnabled ? "liveOn" : ""} type="button" onClick={toggleAutoRefresh}>
          <Bell size={18} />
          {autoRefreshEnabled ? "Atualizacao ativa" : "Atualizacao pausada"}
        </button>
        <span>Notifica novas entregas enquanto o PWA esta aberto.</span>
        <span>{syncLabel}</span>
      </section>

      {error ? <Banner tone="danger" text={error} /> : null}
      {notice ? <Banner tone="success" text={notice} /> : null}

      <nav className="tabs" aria-label="Navegacao principal">
        <button className={view === "deliveries" ? "active" : ""} type="button" onClick={() => setView("deliveries")}>
          <Truck size={18} />
          Entregas
        </button>
        <button className={view === "route" ? "active" : ""} type="button" onClick={() => setView("route")}>
          <Route size={18} />
          Rota
        </button>
      </nav>

      <button className="refreshButton" type="button" onClick={() => void loadOperationalData()} disabled={loading}>
        <RefreshCw size={18} className={loading ? "spin" : ""} />
        Buscar agora
      </button>

      {view === "deliveries" ? (
        <DeliveryList
          availableDeliveries={sections.available}
          activeDeliveries={sections.active}
          loading={loading}
          error={error}
          available={available}
          courierId={courierId}
          busyAction={busyAction}
          onRetry={() => void loadOperationalData()}
          eventsByDelivery={eventsByDelivery}
          onLoadEvents={async (deliveryId) => {
            const events = await fetchDeliveryEvents(deliveryId, serviceArea);
            setEventsByDelivery((current) => ({ ...current, [deliveryId]: events }));
          }}
          onAccept={(deliveryId) => {
            if (!courierId) {
              setError("Seu usuario nao tem motoboy vinculado.");
              return;
            }
            void runAction(
              `accept:${deliveryId}`,
              async () => {
                await acceptDelivery({ deliveryId, courierId, serviceArea });
                setAvailable(false);
                setInDeliveryOperation(true);
                setOpenAppTracking(true);
              },
              "Entrega pega. A loja vai acompanhar o atendimento.",
            );
          }}
          onCollect={(deliveryId) =>
            void runAction(
              `collect:${deliveryId}`,
              async () => {
                await collectDelivery({ deliveryId });
                invalidateDeliveryEvents(deliveryId);
              },
              "Retirada registrada.",
            )
          }
          onStartRoute={(deliveryId) =>
            void runAction(
              `start:${deliveryId}`,
              async () => {
                await startDeliveryRoute({ deliveryId });
                invalidateDeliveryEvents(deliveryId);
              },
              "Entrega iniciada.",
            )
          }
          onComplete={(deliveryId, notes, proof) =>
            void runAction(
              `complete:${deliveryId}`,
              async () => {
                const proofId = proof ? await uploadProofFile(deliveryId, proof) : undefined;
                await completeDelivery(deliveryCompletionInput({ deliveryId, notes, proofId }));
                invalidateDeliveryEvents(deliveryId);
              },
              "Entrega concluida.",
            )
          }
          onProblem={(deliveryId, notes) =>
            void runAction(
              `problem:${deliveryId}`,
              async () => {
                await registerDeliveryProblem({ deliveryId, notes });
                invalidateDeliveryEvents(deliveryId);
              },
              "Problema avisado para a loja.",
            )
          }
        />
      ) : (
        <RoutePanel routes={routes} loading={loading} error={error} onRetry={() => void loadOperationalData()} />
      )}
    </main>
  );
}

function Splash() {
  return (
    <main className="centerScreen">
      <div className="brandMark">
        <img src="/assets/drogaria-santo-antonio-logo.png" alt="Drogaria Santo Antonio" />
      </div>
      <p>Carregando operacao...</p>
    </main>
  );
}

function LoginScreen({
  onLogin,
  error,
}: {
  onLogin: (input: { identifier: string; password: string }) => Promise<void>;
  error: string | null;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setLocalError(null);
    try {
      await onLogin({ identifier, password });
    } catch (err) {
      setLocalError(messageFrom(err, "Nao foi possivel entrar agora."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginScreen">
      <section className="loginHero">
        <div className="brandMark">
          <img src="/assets/drogaria-santo-antonio-logo.png" alt="Drogaria Santo Antonio" />
        </div>
        <h1>Motoboy</h1>
        <p>Drogaria Santo Antonio</p>
      </section>

      <form className="loginForm" onSubmit={submit}>
        <label>
          Nome, email ou telefone
          <input
            autoComplete="username"
            inputMode="email"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {(localError || error) && <Banner tone="danger" text={localError ?? error ?? ""} />}
        <button className="primaryButton" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <InstallHint />
    </main>
  );
}

function DeliveryList(props: {
  availableDeliveries: Delivery[];
  activeDeliveries: Delivery[];
  loading: boolean;
  error: string | null;
  available: boolean;
  courierId: string | null;
  busyAction: BusyAction;
  onRetry: () => void;
  eventsByDelivery: Record<string, DeliveryEvent[]>;
  onLoadEvents: (deliveryId: string) => Promise<void>;
  onAccept: (deliveryId: string) => void;
  onCollect: (deliveryId: string) => void;
  onStartRoute: (deliveryId: string) => void;
  onComplete: (deliveryId: string, notes?: string, proof?: File) => void;
  onProblem: (deliveryId: string, notes: string) => void;
}) {
  const [section, setSection] = useState<DeliveryListSection>("available");
  const hasDeliveries = props.availableDeliveries.length > 0 || props.activeDeliveries.length > 0;

  if (props.loading && !hasDeliveries) {
    return (
      <section className="contentStack">
        <StateBlock
          tone="loading"
          icon={<RefreshCw size={20} />}
          title="Carregando entregas"
          text="Atualizando corridas disponiveis e entregas em atendimento."
        />
      </section>
    );
  }

  if (props.error && !hasDeliveries) {
    return (
      <section className="contentStack">
        <StateBlock
          tone="danger"
          icon={<AlertTriangle size={20} />}
          title="Nao foi possivel carregar entregas"
          text={props.error}
          action={
            <button className="secondaryButton" type="button" onClick={props.onRetry}>
              Tentar novamente
            </button>
          }
        />
      </section>
    );
  }

  return (
    <section className="contentStack">
      <div className="sectionTabs" aria-label="Categorias de entregas">
        <button className={section === "available" ? "active" : ""} type="button" onClick={() => setSection("available")}>
          Disponiveis ({props.availableDeliveries.length})
        </button>
        <button className={section === "active" ? "active" : ""} type="button" onClick={() => setSection("active")}>
          Minhas ({props.activeDeliveries.length})
        </button>
      </div>

      {section === "available" ? (
        <>
          <h2>Entregas disponiveis</h2>
          {props.availableDeliveries.length ? (
            props.availableDeliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery}>
                <button
                  className="primaryButton"
                  type="button"
                  disabled={!props.available || !props.courierId || props.busyAction === `accept:${delivery.id}`}
                  onClick={() => props.onAccept(delivery.id)}
                >
                  <CheckCircle2 size={18} />
                  {props.available ? "Pegar entrega" : "Corridas paradas"}
                </button>
              </DeliveryCard>
            ))
          ) : (
            <EmptyState text="Nenhuma entrega nova agora." />
          )}
        </>
      ) : null}

      {section === "active" ? (
        <>
          <h2>Minhas entregas</h2>
          {props.activeDeliveries.length ? (
            props.activeDeliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery}>
                <DeliveryActions
                  delivery={delivery}
                  busyAction={props.busyAction}
                  events={props.eventsByDelivery[delivery.id]}
                  onLoadEvents={() => props.onLoadEvents(delivery.id)}
                  onCollect={() => props.onCollect(delivery.id)}
                  onStartRoute={() => props.onStartRoute(delivery.id)}
                  onComplete={(notes, proof) => props.onComplete(delivery.id, notes, proof)}
                  onProblem={(notes) => props.onProblem(delivery.id, notes)}
                />
              </DeliveryCard>
            ))
          ) : (
            <EmptyState text="Voce ainda nao tem entregas em atendimento." />
          )}
        </>
      ) : null}
    </section>
  );
}

function DeliveryCard({ delivery, children }: { delivery: Delivery; children: React.ReactNode }) {
  const mapUrl = deliveryMapSearchUrl(delivery);

  return (
    <article className="deliveryCard">
      <div className="cardHeader">
        <div>
          <strong>{deliveryPrimaryCodeLabel(delivery)}</strong>
          {deliveryDailyNumberLabel(delivery) ? <span className="fullCode">{delivery.publicCode}</span> : null}
          <span>{delivery.store}</span>
        </div>
        <span className={`pill ${delivery.priority.toLowerCase()}`}>{deliveryPriorityLabel(delivery.priority)}</span>
      </div>
      <h3>{delivery.customer}</h3>
      <p className="address">{delivery.address}</p>
      {delivery.notes?.trim() ? <p className="paymentNotes">{delivery.notes.trim()}</p> : null}
      <div className="metaRow">
        <span>{deliveryStatusLabel(delivery.status)}</span>
        <span>{deliveryCardDateLabel(delivery.earliestDispatchAt ?? delivery.createdAt)}</span>
      </div>
      <div className="quickActions">
        <a href={phoneDialUrl(delivery.phone)}>
          <Phone size={17} />
          Ligar
        </a>
        {mapUrl ? (
          <a href={mapUrl} target="_blank" rel="noreferrer">
            <Navigation size={17} />
            Mapa
          </a>
        ) : (
          <span className="quickActionNotice">
            <Navigation size={17} />
            Endereco pendente
          </span>
        )}
      </div>
      <div className="cardActions">{children}</div>
    </article>
  );
}

function DeliveryActions(props: {
  delivery: Delivery;
  busyAction: BusyAction;
  events?: DeliveryEvent[];
  onLoadEvents: () => Promise<void>;
  onCollect: () => void;
  onStartRoute: () => void;
  onComplete: (notes?: string, proof?: File) => void;
  onProblem: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [problemNotes, setProblemNotes] = useState("");
  const [proof, setProof] = useState<File | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  async function loadHistory() {
    if (historyLoading || props.events) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      await props.onLoadEvents();
    } catch (err) {
      setHistoryError(messageFrom(err, "Nao foi possivel carregar o historico agora."));
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (showHistory && !props.events && !historyLoading && !historyError) {
      void loadHistory();
    }
  }, [historyError, historyLoading, props.events, showHistory]);

  useEffect(() => {
    setNotes("");
    setProblemNotes("");
    setProof(undefined);
  }, [props.delivery.status]);

  return (
    <>
      {props.delivery.status === "ACEITA_PELO_MOTOBOY" ? (
        <button className="primaryButton" type="button" disabled={props.busyAction === `collect:${props.delivery.id}`} onClick={props.onCollect}>
          <Truck size={18} />
          Retirei na loja
        </button>
      ) : null}

      {props.delivery.status === "COLETADA" ? (
        <button className="primaryButton" type="button" disabled={props.busyAction === `start:${props.delivery.id}`} onClick={props.onStartRoute}>
          <Send size={18} />
          Comecar entrega
        </button>
      ) : null}

      {props.delivery.status === "EM_ROTA" ? (
        <div className="finishBox">
          <label>
            Confirmacao
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex: entregue para Maria" />
          </label>
          <label className="filePicker">
            <Camera size={18} />
            {proof ? proof.name : "Foto opcional"}

            {/* compat-api/html-ignore-next-line */}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              onChange={(event) => setProof(event.target.files?.[0])}
            />
          </label>
          <button
            className="primaryButton"
            type="button"
            disabled={!notes.trim() || props.busyAction === `complete:${props.delivery.id}`}
            onClick={() => props.onComplete(notes.trim(), proof)}
          >
            <CheckCircle2 size={18} />
            Concluir
          </button>
        </div>
      ) : null}

      <div className="problemBox">
        <strong>
          <AlertTriangle size={18} />
          Avisar problema
        </strong>
        <textarea
          value={problemNotes}
          onChange={(event) => setProblemNotes(event.target.value)}
          placeholder="Conte o que aconteceu"
        />
        <button
          className="secondaryButton danger"
          type="button"
          disabled={!problemNotes.trim() || props.busyAction === `problem:${props.delivery.id}`}
          onClick={() => props.onProblem(problemNotes.trim())}
        >
          Avisar loja
        </button>
      </div>

      <button
        className="secondaryButton"
        type="button"
        onClick={() => {
          const nextShowHistory = !showHistory;
          setShowHistory(nextShowHistory);
          if (nextShowHistory) void loadHistory();
        }}
      >
        <Clock3 size={18} />
        {historyLoading ? "Carregando..." : "Ver historico"}
      </button>
      {showHistory ? (
        <History
          events={props.events}
          loading={historyLoading}
          error={historyError}
          onRetry={loadHistory}
        />
      ) : null}
    </>
  );
}

function RoutePanel({
  routes,
  loading,
  error,
  onRetry,
}: {
  routes: CourierRoute[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const activeRoutes = activeRoutesWithPendingStops(routes);

  return (
    <section className="contentStack">
      <h2>Rota atual</h2>
      {loading && !activeRoutes.length ? (
        <StateBlock
          tone="loading"
          icon={<RefreshCw size={20} />}
          title="Carregando rota"
          text="Buscando paradas pendentes das rotas ativas."
        />
      ) : error && !activeRoutes.length ? (
        <StateBlock
          tone="danger"
          icon={<AlertTriangle size={20} />}
          title="Nao foi possivel carregar rota"
          text={error}
          action={
            <button className="secondaryButton" type="button" onClick={onRetry}>
              Tentar novamente
            </button>
          }
        />
      ) : activeRoutes.length ? (
        <>
          {activeRoutes.map(({ route, pendingStops }) => {
            const mapsSegment = buildRouteMapsSegment(pendingStops);
            const routeSegmentNotice = routeSegmentNoticeText(mapsSegment);
            const routeMapsUnavailable = routeMapsUnavailableText(mapsSegment);
            const mapsLinkLabel = routeMapsLinkLabel(mapsSegment);

            return (
              <article className="deliveryCard routeCard" key={route.id}>
                <div className="cardHeader">
                  <div>
                    <strong>{route.courier.name}</strong>
                    <span>{routeStatusLabel(route.status)}</span>
                  </div>
                </div>
                {routeMapsUnavailable ? (
                  <p className="routeSegmentNotice">{routeMapsUnavailable}</p>
                ) : (
                  <a className="primaryButton routeLink" href={mapsSegment.url} target="_blank" rel="noreferrer">
                    <Navigation size={18} />
                    {mapsLinkLabel}
                  </a>
                )}
                {routeSegmentNotice ? <p className="routeSegmentNotice">{routeSegmentNotice}</p> : null}
                <ol className="routeList">
                  {pendingStops.map((stop) => (
                    <li key={stop.id}>
                      <span>{stop.sequence}</span>
                      <div>
                        <strong>{routeStopTitle(stop)}</strong>
                        {routeStopDetails(stop) ? <small>{routeStopDetails(stop)}</small> : null}
                        <p>{stop.address}</p>
                        <RouteStopSchedule earliestAt={stop.earliestAt} />
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </>
      ) : (
        <EmptyState text="Nenhuma parada pendente na rota." />
      )}
    </section>
  );
}

function History({
  events,
  loading,
  error,
  onRetry,
}: {
  events?: DeliveryEvent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) return <p className="muted">Carregando historico...</p>;
  if (error) {
    return (
      <div className="historyError">
        <p>{error}</p>
        <button className="secondaryButton" type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    );
  }
  if (!events) return <p className="muted">Historico ainda nao carregado.</p>;
  if (!events.length) return <p className="muted">Sem eventos registrados.</p>;

  return (
    <ul className="historyList">
      {events.map((event) => (
        <HistoryItem key={event.id} event={event} />
      ))}
    </ul>
  );
}

function RouteStopSchedule({ earliestAt }: { earliestAt?: string | null }) {
  const label = routeStopScheduleLabel(earliestAt);
  return label ? <small>{label}</small> : null;
}

function HistoryItem({ event }: { event: DeliveryEvent }) {
  const actor = deliveryEventActorLabel(event);
  const notes = deliveryEventNotesText(event);

  return (
    <li>
      <strong>{deliveryEventTypeLabel(event.type)}</strong>
      <span>
        {actor
          ? `${actor} - ${deliveryEventTimestampLabel(event.createdAt)}`
          : deliveryEventTimestampLabel(event.createdAt)}
      </span>
      {notes ? <p>{notes}</p> : null}
    </li>
  );
}

function InstallHint() {
  return (
    <aside className="installHint">
      <strong>iPhone</strong>
      <span>Abra no Safari, toque em Compartilhar e use Adicionar a Tela de Inicio.</span>
    </aside>
  );
}

function Banner({ tone, text }: { tone: "danger" | "success"; text: string }) {
  return <div className={`banner ${tone}`}>{text}</div>;
}

function StateBlock({
  tone = "neutral",
  icon,
  title,
  text,
  action,
}: {
  tone?: "neutral" | "loading" | "danger";
  icon?: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  const roleProps = tone === "danger" ? { role: "alert" } : { role: "status" };

  return (
    <div className={`stateBlock ${tone}`} {...roleProps}>
      {icon ? <span className={tone === "loading" ? "spin stateIcon" : "stateIcon"}>{icon}</span> : null}
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
      {action ? <div className="stateAction">{action}</div> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <StateBlock title={text} />;
}

async function uploadProofFile(deliveryId: string, file: File) {
  const upload = await prepareProofUpload(file, `comprovante-${deliveryId}.jpg`);
  const proof = await uploadDeliveryProof({
    deliveryId,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    contentBase64: upload.contentBase64,
  });
  return proof.id;
}

function messageFrom(error: unknown, fallback = "Nao foi possivel concluir agora.") {
  return userFacingError(error, fallback);
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission().catch(() => undefined);
  }
}

async function preferredAvailability(session: AuthSession, serviceArea: CourierServiceArea) {
  const savedAvailability = localStorage.getItem(AVAILABILITY_KEY);
  const nextAvailable = savedAvailability == null ? true : savedAvailability === "true";
  localStorage.setItem(AVAILABILITY_KEY, String(nextAvailable));
  if (!session.courier?.id) return false;

  await updateAvailability({
    courierId: session.courier.id,
    available: nextAvailable,
    serviceArea,
  }).catch(() => undefined);

  return nextAvailable;
}

function locationWatchText(input: {
  fallback: string;
  trackingEnabled: boolean;
  operationallyActive: boolean;
  lastLocationSentAt: Date | null;
}) {
  if (!input.operationallyActive) return input.fallback;
  if (!input.trackingEnabled) return "GPS ao vivo ainda nao ligou. Confira a permissao de localizacao.";
  if (!input.lastLocationSentAt) return "Aguardando o primeiro envio automatico de localizacao.";

  const ageMs = Date.now() - input.lastLocationSentAt.getTime();
  if (ageMs <= LOCATION_STALE_WARNING_MS) {
    return `GPS ao vivo atualizado ha ${Math.max(0, Math.round(ageMs / 1000))}s.`;
  }

  return `A loja esta sem localizacao nova ha ${Math.round(ageMs / 1000)}s. Mantenha o app aberto e confira o GPS.`;
}

async function requestLocationPermission() {
  if (!navigator.geolocation) return false;

  return new Promise<boolean>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 },
    );
  });
}

function showLocalNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });
  } catch {
    // Safari/iOS can reject notifications outside supported install modes.
  }
}

function stopOpenAppTracking(watchIdRef: { current: number | null }) {
  if (watchIdRef.current === null || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(watchIdRef.current);
  watchIdRef.current = null;
}

function syncCourierAvailabilityWithServiceWorker(available: boolean) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({
        type: "FARMADELIVERY_COURIER_AVAILABILITY",
        available,
      });
    })
    .catch(() => undefined);
}
