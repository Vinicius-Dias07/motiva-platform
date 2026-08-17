import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Alert, ImageEntry } from "../types";
import {
  GeoJSON,
  LayersControl,
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

export interface MapViewHandle {
  focusAlert: (latitude: number, longitude: number) => void;
}
const MapController = forwardRef<MapViewHandle>((_, ref) => {
  const map = useMap();

  useImperativeHandle(
    ref,
    () => ({
      focusAlert(latitude, longitude) {
        map.flyTo([latitude, longitude], 15, {
          duration: 1.2,
        });
      },
    }),
    [map],
  );

  return null;
});

MapController.displayName = "MapController";

interface MapViewProps {
  alerts: Alert[];
  images: ImageEntry[];
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  ({ alerts, images }, ref) => {
    const [rodoanel, setRodoanel] = useState<any>(null);
    const [viaDutra, setViaDutra] = useState<any>(null);
    const [autoban, setAutoban] = useState<any>(null);

    useEffect(() => {
      fetch("/geojson/rodoanel_rocada.geojson")
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Erro ao carregar Rodoanel: ${response.status}`);
          }

          return response.json();
        })
        .then((data) => {
          setRodoanel(data);
        })
        .catch((error) => {
          console.error("Erro ao carregar GeoJSON do Rodoanel:", error);
        });
      fetch("/geojson/via_dutra.geojson")
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Erro ao carregar Via Dutra: ${response.status}`);
          }

          return response.json();
        })
        .then((data) => {
          setViaDutra(data);
        })
        .catch((error) => {
          console.error("Erro ao carregar GeoJSON da Via Dutra:", error);
        });
      fetch("/geojson/autoban.geojson")
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Erro ao carregar AutoBAn: ${response.status}`);
          }

          return response.json();
        })
        .then((data) => {
          setAutoban(data);
        })
        .catch((error) => {
          console.error("Erro ao carregar GeoJSON da AutoBAn:", error);
        });
    }, []);

    return (
      <div className="w-full h-full">
        <MapContainer
          center={[-23.58, -46.72]}
          zoom={11}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <LayersControl position="topright">
            {rodoanel && (
              <LayersControl.Overlay checked name="Rodoanel Oeste">
                <GeoJSON
                  data={rodoanel}
                  style={{
                    color: "#22d3ee",
                    weight: 5,
                    opacity: 0.9,
                  }}
                />
              </LayersControl.Overlay>
            )}

            {viaDutra && (
              <LayersControl.Overlay checked name="Via Dutra">
                <GeoJSON
                  data={viaDutra}
                  style={{
                    color: "#22d3ee",
                    weight: 4,
                    opacity: 0.9,
                  }}
                />
              </LayersControl.Overlay>
            )}

            {autoban && (
              <LayersControl.Overlay checked name="AutoBAn">
                <GeoJSON
                  data={autoban}
                  style={{
                    color: "#22d3ee",
                    weight: 4,
                    opacity: 0.9,
                  }}
                />
              </LayersControl.Overlay>
            )}
          </LayersControl>
          {alerts
            .filter(
              (alert) =>
                alert.status !== "resolvido" &&
                typeof alert.latitude === "number" &&
                typeof alert.longitude === "number",
            )
            .map((alert) => {
              const imagem = images.find((image) => image.id === alert.imageId);

              const cor =
                alert.severity === "high"
                  ? "#ef4444"
                  : alert.severity === "medium"
                    ? "#f59e0b"
                    : "#22c55e";

              return (
                <CircleMarker
                  key={alert.id}
                  center={[alert.latitude!, alert.longitude!]}
                  radius={9}
                  pathOptions={{
                    color: cor,
                    fillColor: cor,
                    fillOpacity: 0.85,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="w-[260px] font-mono text-xs">
                      <div className="font-semibold mb-2">{alert.id}</div>

                      <div className="mb-2">{alert.title}</div>

                      <div className="space-y-1 text-gray-600">
                        <div>Severidade: {alert.severity.toUpperCase()}</div>

                        <div>Status: {alert.status}</div>

                        {alert.imageId && <div>Imagem: {alert.imageId}</div>}

                        <div>Latitude: {alert.latitude!.toFixed(6)}</div>

                        <div>Longitude: {alert.longitude!.toFixed(6)}</div>

                        {alert.confianca !== undefined && (
                          <div>
                            Confiança: {(alert.confianca * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>

                      {imagem?.url && (
                        <img
                          src={imagem.url}
                          alt={imagem.name}
                          className="w-full h-36 object-cover mt-3"
                        />
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          <MapController ref={ref} />
        </MapContainer>
      </div>
    );
  },
);

MapView.displayName = "MapView";

export default MapView;
