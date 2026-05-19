import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Clock3,
  LogOut,
  MapPin,
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
  sendLocationActionLabel,
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

const TOKEN_KEY = "farmadelivery.motoboy.token";
const TRACKING_KEY = "farmadelivery.motoboy.tracking";
const AUTO_REFRESH_KEY = "farmadelivery.motoboy.autoRefresh";
const SERVICE_AREA_KEY = "farmadelivery.motoboy.serviceArea";
const WEB_PUSH_TOKEN_KEY = "farmadelivery.motoboy.webPushToken";
const FIREBASE_WEB_PUSH_VAPID_KEY = import.meta.env.VITE_FIREBASE_WEB_PUSH_VAPID_KEY;

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
  const [serviceArea, setServiceArea] = useState<CourierServiceArea>(() =>
    normalizeCourierServiceArea(localStorage.getItem(SERVICE_AREA_KEY)),
  );
  const [trackingEnabled, setTrackingEnabled] = useState(() => localStorage.getItem(TRACKING_KEY) === "true");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => localStorage.getItem(AUTO_REFRESH_KEY) !== "false");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastTrackedLocationRef = useRef<{ latitude: number; longitude: number; sentAt: number } | null>(null);
  const deliveriesRef = useRef<Delivery[]>([]);

  const courierId = session?.courier?.id ?? null;

  const loadOperationalData = useCallback(async (silent = false) => {
    if (!session) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [nextDeliveries, nextRoutes] = await Promise.all([fetchDeliveries(serviceArea), fetchCourierRoutes()]);
      const notification = summarizeOperationalChangesForAvailability(deliveriesRef.current, nextDeliveries, available);
      if (silent && notification) {
        setNotice(notification.body);
        showLocalNotification(notification.title, notification.body);
      }
      deliveriesRef.current = nextDeliveries;
      setDeliveries(nextDeliveries);
      setRoutes(nextRoutes);
      setLastSyncedAt(new Date());
    } catch (err) {
      if (!silent) setError(messageFrom(err));
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
      .then((nextSession) => {
        if (nextSession.role !== "MOTOBOY") {
          throw new Error("Este acesso e exclusivo para motoboys.");
        }
        setAvailable(nextSession.courier?.available == true);
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
    if (!session || !autoRefreshEnabled) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadOperationalData(true);
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled, loadOperationalData, session]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearLocalSession("Sessao expirada. Entre novamente.");
    };
    window.addEventListener("farmadelivery:unauthorized", onUnauthorized);
    return () => window.removeEventListener("farmadelivery:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    if (
      !canTrackOpenAppLocation({
        hasSession: Boolean(session),
        hasCourier: Boolean(courierId),
        trackingEnabled,
        available,
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

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        if (!shouldSendTrackedLocation(lastTrackedLocationRef.current, latitude, longitude)) return;

        updateLocation({
          courierId: activeCourierId,
          latitude,
          longitude,
        })
          .then(() => {
            lastTrackedLocationRef.current = {
              latitude,
              longitude,
              sentAt: Date.now(),
            };
          })
          .catch((err) => setError(messageFrom(err)));
      },
      () => {
        setTrackingEnabled(false);
        localStorage.removeItem(TRACKING_KEY);
        setError("GPS automatico pausado. Confira a permissao de localizacao do Safari.");
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );

    return () => stopOpenAppTracking(watchIdRef);
  }, [available, courierId, session, trackingEnabled]);

  const sections = useMemo(() => deliverySections(deliveries), [deliveries]);

  async function handleLogin(input: { identifier: string; password: string }) {
    setError(null);
    const nextSession = await login(input);
    if (nextSession.role !== "MOTOBOY") {
      throw new Error("Este acesso e exclusivo para motoboys.");
    }

    localStorage.setItem(TOKEN_KEY, nextSession.token);
    setAuthToken(nextSession.token);
    setAvailable(nextSession.courier?.available == true);
    setSession(nextSession);
  }

  async function logout() {
    if (courierId) {
      await updateAvailability({ courierId, available: false }).catch(() => undefined);
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
    setTrackingEnabled(false);
    stopOpenAppTracking(watchIdRef);
    setDeliveries([]);
    deliveriesRef.current = [];
    setRoutes([]);
    setEventsByDelivery({});
    setLastSyncedAt(null);
    setBusyAction(null);
    setNotice(null);
    setError(message ?? null);
  }

  async function runAction(label: string, run: () => Promise<unknown>) {
    setBusyAction(label);
    setError(null);
    setNotice(null);
    try {
      await run();
      setNotice("Acao registrada com sucesso.");
      await loadOperationalData();
    } catch (err) {
      setError(messageFrom(err));
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

  async function sendCurrentLocation() {
    if (!courierId) {
      setError("Seu usuario nao tem motoboy vinculado.");
      return;
    }
    if (!navigator.geolocation) {
      setError("Este iPhone nao liberou geolocalizacao no navegador.");
      return;
    }

    setBusyAction("location");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation({
          courierId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
          .then(() => {
            setNotice("Localizacao enviada.");
          })
          .catch((err) => setError(messageFrom(err)))
          .finally(() => setBusyAction(null));
      },
      () => {
        setBusyAction(null);
        setError("Nao consegui acessar a localizacao. Confira a permissao do Safari.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function toggleOpenAppTracking() {
    if (!available) {
      setNotice("Ative sua disponibilidade antes de ligar o GPS automatico.");
      return;
    }
    const nextValue = !trackingEnabled;
    setTrackingEnabled(nextValue);
    if (nextValue) {
      localStorage.setItem(TRACKING_KEY, "true");
      setNotice("GPS automatico ativo enquanto o PWA estiver aberto.");
    } else {
      localStorage.removeItem(TRACKING_KEY);
      stopOpenAppTracking(watchIdRef);
      setNotice("GPS automatico pausado.");
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
      const courier = await updateAvailability({ courierId, available: nextAvailable });
      setAvailable(Boolean(courier?.available));
      if (!nextAvailable) {
        setTrackingEnabled(false);
        localStorage.removeItem(TRACKING_KEY);
        stopOpenAppTracking(watchIdRef);
      }
      setNotice(
        nextAvailable
          ? "Voce esta disponivel para receber corridas."
          : "Voce esta indisponivel. Novas corridas nao serao direcionadas para voce.",
      );
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusyAction(null);
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

  function selectServiceArea(nextServiceArea: CourierServiceArea) {
    setServiceArea(nextServiceArea);
    localStorage.setItem(SERVICE_AREA_KEY, nextServiceArea);
    deliveriesRef.current = [];
    setDeliveries([]);
    setNotice(`${courierServiceAreaLabel(nextServiceArea)} selecionada.`);
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
        <p>{operationalStatus.text}</p>
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
              onClick={() => selectServiceArea(area)}
            >
              {courierServiceAreaLabel(area).replace("Praca ", "")}
            </button>
          ))}
        </div>
      </section>

      <section className="statusActions" aria-label="Acoes de disponibilidade e localizacao">
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
        <button type="button" onClick={sendCurrentLocation} disabled={!available || busyAction === "location"}>
          <MapPin size={18} />
          {sendLocationActionLabel(busyAction === "location")}
        </button>
        <button className={trackingEnabled ? "trackingOn" : ""} type="button" onClick={toggleOpenAppTracking} disabled={!available}>
          <Navigation size={18} />
          {automaticLocationActionLabel(trackingEnabled)}
        </button>
      </section>

      {!available ? (
        <Banner
          tone="danger"
          text="Voce esta indisponivel. Ative sua disponibilidade para receber novas corridas."
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
        Atualizar
      </button>

      {view === "deliveries" ? (
        <DeliveryList
          availableDeliveries={sections.available}
          activeDeliveries={sections.active}
          available={available}
          courierId={courierId}
          busyAction={busyAction}
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
            void runAction(`accept:${deliveryId}`, async () => {
              await acceptDelivery({ deliveryId, courierId, serviceArea });
              setAvailable(false);
              setTrackingEnabled(false);
              localStorage.removeItem(TRACKING_KEY);
              stopOpenAppTracking(watchIdRef);
            });
          }}
          onCollect={(deliveryId) =>
            void runAction(`collect:${deliveryId}`, async () => {
              await collectDelivery({ deliveryId });
              invalidateDeliveryEvents(deliveryId);
            })
          }
          onStartRoute={(deliveryId) =>
            void runAction(`start:${deliveryId}`, async () => {
              await startDeliveryRoute({ deliveryId });
              invalidateDeliveryEvents(deliveryId);
            })
          }
          onComplete={(deliveryId, notes, proof) =>
            void runAction(`complete:${deliveryId}`, async () => {
              const proofId = proof ? await uploadProofFile(deliveryId, proof) : undefined;
              await completeDelivery(deliveryCompletionInput({ deliveryId, notes, proofId }));
              invalidateDeliveryEvents(deliveryId);
            })
          }
          onProblem={(deliveryId, notes) =>
            void runAction(`problem:${deliveryId}`, async () => {
              await registerDeliveryProblem({ deliveryId, notes });
              invalidateDeliveryEvents(deliveryId);
            })
          }
        />
      ) : (
        <RoutePanel routes={routes} />
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
      setLocalError(messageFrom(err));
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
          Email ou telefone
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
  available: boolean;
  courierId: string | null;
  busyAction: BusyAction;
  eventsByDelivery: Record<string, DeliveryEvent[]>;
  onLoadEvents: (deliveryId: string) => Promise<void>;
  onAccept: (deliveryId: string) => void;
  onCollect: (deliveryId: string) => void;
  onStartRoute: (deliveryId: string) => void;
  onComplete: (deliveryId: string, notes?: string, proof?: File) => void;
  onProblem: (deliveryId: string, notes: string) => void;
}) {
  const [section, setSection] = useState<DeliveryListSection>("available");

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
                  {props.available ? "Aceitar" : "Indisponivel"}
                </button>
              </DeliveryCard>
            ))
          ) : (
            <EmptyState text="Nenhuma entrega disponivel agora." />
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
      setHistoryError(messageFrom(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (showHistory && !props.events && !historyLoading && !historyError) {
      void loadHistory();
    }
  }, [historyError, historyLoading, props.events, showHistory]);

  return (
    <>
      {props.delivery.status === "ACEITA_PELO_MOTOBOY" ? (
        <button className="primaryButton" type="button" disabled={props.busyAction === `collect:${props.delivery.id}`} onClick={props.onCollect}>
          <Truck size={18} />
          Coletar
        </button>
      ) : null}

      {props.delivery.status === "COLETADA" ? (
        <button className="primaryButton" type="button" disabled={props.busyAction === `start:${props.delivery.id}`} onClick={props.onStartRoute}>
          <Send size={18} />
          Sair em rota
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

      <details className="problemBox">
        <summary>
          <AlertTriangle size={18} />
          Registrar problema
        </summary>
        <textarea
          value={problemNotes}
          onChange={(event) => setProblemNotes(event.target.value)}
          placeholder="Descreva o problema"
        />
        <button
          className="secondaryButton danger"
          type="button"
          disabled={!problemNotes.trim() || props.busyAction === `problem:${props.delivery.id}`}
          onClick={() => props.onProblem(problemNotes.trim())}
        >
          Salvar problema
        </button>
      </details>

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
        {historyLoading ? "Carregando..." : "Historico"}
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

function RoutePanel({ routes }: { routes: CourierRoute[] }) {
  const activeRoutes = activeRoutesWithPendingStops(routes);

  return (
    <section className="contentStack">
      <h2>Rota atual</h2>
      {activeRoutes.length ? (
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

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
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

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission().catch(() => undefined);
  }
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
