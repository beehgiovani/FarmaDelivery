import L from "leaflet";
import { Bike, Building2, Home, Route } from "lucide-react";
import { useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { mapRawRouteStatusLabel } from "../apiMappers";
import { buildOperationsMapDeliverySummary } from "../operationsMapSummary";
import { routeStopMapLabel } from "../routeStopDisplay";
import type { Courier, CourierRoute, Delivery, DeliveryStatus, StoreUnit } from "../types";
import { StateBlock } from "./StateBlock";

type OperationsMapProps = {
  stores: StoreUnit[];
  couriers: Courier[];
  deliveries: Delivery[];
  courierRoutes: CourierRoute[];
  statusFilter: DeliveryStatus | "Todas";
  dateFilter: string;
  loading?: boolean;
  error?: string | null;
  onStatusFilterChange: (status: DeliveryStatus | "Todas") => void;
  onDateFilterChange: (date: string) => void;
};

const storeIcon = L.divIcon({
  className: "mapDivIcon",
  html: '<span class="leafletPin storeLeafletPin"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const courierIcon = L.divIcon({
  className: "mapDivIcon",
  html: '<span class="leafletPin courierLeafletPin"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function createDeliveryIcon(status: DeliveryStatus) {
  return L.divIcon({
    className: "mapDivIcon",
    html: `<span class="leafletPin deliveryLeafletPin ${deliveryIconClass(status)}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createRouteStopIcon(sequence: number) {
  return L.divIcon({
    className: "mapDivIcon",
    html: `<span class="routeStopLeafletPin">${sequence}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const statusOptions: Array<DeliveryStatus | "Todas"> = [
  "Todas",
  "Aguardando",
  "Aceita",
  "Coletada",
  "Em rota",
  "Entregue",
  "Problema",
  "Cancelada",
];

type MapSection = "map" | "couriers";

export function OperationsMap({
  stores,
  couriers,
  deliveries,
  courierRoutes,
  statusFilter,
  dateFilter,
  loading = false,
  error,
  onStatusFilterChange,
  onDateFilterChange,
}: OperationsMapProps) {
  const [activeSection, setActiveSection] = useState<MapSection>("map");
  const storesWithCoordinates = stores.filter((store) => store.coordinates);
  const deliveriesWithCoordinates = deliveries.filter((delivery) => delivery.coordinates);
  const deliverySummary = buildOperationsMapDeliverySummary({
    total: deliveries.length,
    located: deliveriesWithCoordinates.length,
  });
  const activeRouteLines = buildRouteLines(courierRoutes, couriers);
  const hasMapData =
    storesWithCoordinates.length > 0 ||
    couriers.length > 0 ||
    deliveriesWithCoordinates.length > 0 ||
    activeRouteLines.length > 0;

  return (
    <section className="mapPanel" id="mapa" aria-label="Mapa operacional">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Mapa operacional</span>
          <h2>Motoboys e lojas</h2>
        </div>
        <span className="liveBadge">ao vivo</span>
      </div>

      <div className="mapFilters" aria-label="Filtros do mapa">
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as DeliveryStatus | "Todas")}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Dia</span>
          <input type="date" value={dateFilter} onChange={(event) => onDateFilterChange(event.target.value)} />
        </label>
        <strong>{deliverySummary}</strong>
      </div>

      <div className="sectionTabs" aria-label="Categorias do mapa operacional">
        <button className={activeSection === "map" ? "selected" : ""} type="button" onClick={() => setActiveSection("map")}>
          Mapa
        </button>
        <button className={activeSection === "couriers" ? "selected" : ""} type="button" onClick={() => setActiveSection("couriers")}>
          Motoboys
        </button>
      </div>

      {loading ? (
        <StateBlock
          tone="loading"
          title="Carregando mapa operacional"
          description="Buscando lojas, motoboys, entregas e rotas ativas."
        />
      ) : error ? (
        <StateBlock tone="error" title="Mapa parcialmente indisponivel" description={error} />
      ) : activeSection === "map" && hasMapData ? (
        <div className="leafletFrame">
          <MapContainer center={[-23.966, -46.237]} zoom={12} scrollWheelZoom={false} className="leafletMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {storesWithCoordinates.map((store) => (
              <Marker
                key={store.name}
                position={[store.coordinates!.lat, store.coordinates!.lng]}
                icon={storeIcon}
              >
                <Popup>
                  <strong>{store.name}</strong>
                  <br />
                  {store.code} - base {store.baseType}
                  <br />
                  {store.address}
                </Popup>
              </Marker>
            ))}

            {deliveriesWithCoordinates
              .map((delivery) => (
                <Marker
                  key={delivery.id}
                  position={[delivery.coordinates!.lat, delivery.coordinates!.lng]}
                  icon={createDeliveryIcon(delivery.status)}
                >
                  <Popup>
                    <strong>{delivery.customer}</strong>
                    <br />
                    {delivery.status} - {delivery.store}
                    <br />
                    {delivery.scheduledFor}
                    <br />
                    {delivery.address}
                  </Popup>
                </Marker>
              ))}

            {couriers.map((courier) => (
              <Marker key={courier.id ?? courier.name} position={[courier.coordinates.lat, courier.coordinates.lng]} icon={courierIcon}>
                <Popup>
                  <strong>{courier.name}</strong>
                  <br />
                  {courier.status} - {courier.store}
                </Popup>
              </Marker>
            ))}

            {activeRouteLines.map((routeLine, index) => (
              <Polyline
                key={routeLine.id}
                positions={routeLine.positions}
                pathOptions={{
                  color: routeColors[index % routeColors.length],
                  weight: 4,
                  opacity: 0.82,
                  dashArray: routeLine.status === "ABERTA" ? "8 8" : undefined,
                }}
              />
            ))}

            {activeRouteLines.flatMap((routeLine) =>
              routeLine.stops.map((stop) => (
                <Marker key={`${routeLine.id}-${stop.id}`} position={[stop.lat, stop.lng]} icon={createRouteStopIcon(stop.sequence)}>
                  <Popup>
                    <strong>
                      {routeLine.courierName} - parada {stop.sequence}
                    </strong>
                    <br />
                    {mapRawRouteStatusLabel(routeLine.status, { withPrefix: true })}
                    <br />
                    {stop.label}
                    <br />
                    {stop.address}
                  </Popup>
                </Marker>
              )),
            )}
          </MapContainer>
        </div>
      ) : activeSection === "map" ? (
        <div className="emptyMapState">
          <MapPinIcon />
          <strong>Nada para mostrar no mapa ainda</strong>
          <span>Lojas, motoboys com localizacao e entregas com ponto no mapa aparecem aqui automaticamente.</span>
        </div>
      ) : null}

      {activeSection === "map" ? (
        <div className="mapLegend" aria-label="Legenda do mapa">
          <span>
            <Building2 size={14} /> Lojas
          </span>
          <span>
            <Bike size={14} /> Motoboys
          </span>
          <span>
            <Home size={14} /> Entregas filtradas
          </span>
          <span>
            <Route size={14} /> Rotas ativas
          </span>
        </div>
      ) : null}

      {activeSection === "couriers" ? (
        <div className="courierList" id="motoboys">
          {couriers.length === 0 ? (
            <StateBlock title="Nenhum motoboy com localizacao" description="Quando o app do motoboy enviar a posicao, ele aparece aqui." />
          ) : (
            couriers.map((courier) => (
              <div className="courierRow" key={courier.id ?? courier.name}>
                <span className="avatar">{courier.name.slice(0, 1)}</span>
                <div>
                  <strong>{courier.name}</strong>
                  <small>
                    {courier.store} - {courier.deliveries} entregas
                  </small>
                </div>
                <span className={`statusPill ${courier.status === "Ocorrencia" ? "issue" : ""}`}>{courier.status}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

const routeColors = ["#275397", "#ed1f2b", "#0f766e", "#7c3aed", "#c2410c"];

function buildRouteLines(routes: CourierRoute[], couriers: Courier[]) {
  return routes
    .filter((route) => route.status === "ABERTA" || route.status === "EM_ANDAMENTO")
    .map((route) => {
      const courier = couriers.find((item) => item.id === route.courier.id);
      const stops = route.stops
        .filter((stop) => stop.latitude !== null && stop.latitude !== undefined && stop.longitude !== null && stop.longitude !== undefined)
        .sort((a, b) => a.sequence - b.sequence)
        .map((stop) => ({
          id: stop.id,
          sequence: stop.sequence,
          lat: Number(stop.latitude),
          lng: Number(stop.longitude),
          label: routeStopMapLabel(stop),
          address: stop.address,
        }));

      const positions: Array<[number, number]> = [
        ...(courier ? ([[courier.coordinates.lat, courier.coordinates.lng]] as Array<[number, number]>) : []),
        ...stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
      ];

      return {
        id: route.id,
        status: route.status,
        courierName: route.courier.name,
        positions,
        stops,
      };
    })
    .filter((routeLine) => routeLine.positions.length >= 2);
}

function MapPinIcon() {
  return <span className="emptyMapIcon" aria-hidden="true" />;
}

function deliveryIconClass(status: DeliveryStatus) {
  const classes: Record<DeliveryStatus, string> = {
    Aguardando: "waitingDeliveryPin",
    Aceita: "pickedDeliveryPin",
    Coletada: "pickedDeliveryPin",
    "Em rota": "routeDeliveryPin",
    Entregue: "doneDeliveryPin",
    Problema: "issueDeliveryPin",
    Cancelada: "cancelDeliveryPin",
  };

  return classes[status];
}
