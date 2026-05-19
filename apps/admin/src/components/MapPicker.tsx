import L from "leaflet";
import { MapPin, X } from "lucide-react";
import { useCallback, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

type MapPickerProps = {
  latitude?: number | null;
  longitude?: number | null;
  label?: string;
  onConfirm: (latitude: number, longitude: number) => void;
  onClose: () => void;
};

/** Centro de Guaruja como fallback quando nao ha coordenadas previas. */
const GUARUJA_CENTER: [number, number] = [-23.993, -46.256];
const DEFAULT_ZOOM = 15;

const pickerIcon = L.divIcon({
  className: "mapDivIcon",
  html: '<span class="leafletPin pickerLeafletPin"></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/** Captura cliques no mapa e repassa as coordenadas para o estado externo. */
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Modal de ajuste fino de coordenadas.
 * O atendente clica ou arrasta o pino para corrigir a localizacao da entrega
 * quando o geocode errou o bairro ou a rua e ambigua.
 */
export function MapPicker({ latitude, longitude, label, onConfirm, onClose }: MapPickerProps) {
  const initialLat = typeof latitude === "number" ? latitude : GUARUJA_CENTER[0];
  const initialLng = typeof longitude === "number" ? longitude : GUARUJA_CENTER[1];

  const [pin, setPin] = useState<[number, number]>([initialLat, initialLng]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPin([lat, lng]);
  }, []);

  const handleMarkerDragEnd = useCallback((event: L.DragEndEvent) => {
    const marker = event.target as L.Marker;
    const pos = marker.getLatLng();
    setPin([pos.lat, pos.lng]);
  }, []);

  return (
    <div
      className="mapPickerOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar ponto no mapa"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mapPickerModal">
        <div className="mapPickerHeader">
          <div>
            <strong>Ajustar ponto no mapa</strong>
            <small>
              {label
                ? `Clique ou arraste o marcador para posicionar "${label}" no local correto.`
                : "Clique em qualquer ponto ou arraste o marcador para ajustar a localizacao."}
            </small>
          </div>
          <button className="ghostIcon" type="button" aria-label="Fechar mapa" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="mapPickerCoords" aria-live="polite">
          <MapPin size={14} />
          <span>
            {pin[0].toFixed(6)}, {pin[1].toFixed(6)}
          </span>
        </div>

        <div className="mapPickerFrame">
          <MapContainer center={pin} zoom={DEFAULT_ZOOM} scrollWheelZoom className="leafletMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            <Marker
              position={pin}
              icon={pickerIcon}
              draggable
              eventHandlers={{ dragend: handleMarkerDragEnd }}
            />
          </MapContainer>
        </div>

        <p className="mapPickerHint">
          Clique no mapa ou arraste o marcador vermelho para ajustar o ponto com precisao de bairro.
        </p>

        <div className="formActions">
          <button
            className="primaryButton"
            type="button"
            onClick={() => onConfirm(pin[0], pin[1])}
          >
            Confirmar ponto
          </button>
          <button className="secondaryButton" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
