"use client";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
import * as turf from "@turf/turf";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BufferResult } from "@/lib/geoTools";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type MapResult =
  | { type: "buffer"; data: BufferResult }
  | {
      type: "route";
      data: {
        coordinates: [number, number][];
        start: [number, number];
        end: [number, number];
        mode: string;
      };
    };

function FitBounds({ result }: { result: MapResult }) {
  const map = useMap();

  useEffect(() => {
    if (!result) return;

    if (result.type === "buffer") {
      const [minX, minY, maxX, maxY] = turf.bbox(result.data.polygon);
      map.fitBounds(
        [
          [minY, minX],
          [maxY, maxX],
        ],
        { padding: [40, 40] },
      );
    }

    if (result.type === "route") {
      const bounds = L.latLngBounds(result.data.coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [result, map]);

  return null;
}

export default function GeoMap({
  result,
  label,
}: {
  result: MapResult | null;
  label?: string;
}) {
  const center =
    result?.type === "buffer"
      ? result.data.center
      : result?.type === "route"
        ? result.data.start
        : [40.758, -73.9855];

  return (
    <MapContainer
      center={center as [number, number]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* ========== BUFFER ========== */}
      {result?.type === "buffer" && (
        <>
          <GeoJSON
            key={JSON.stringify(result.data.polygon.geometry.coordinates[0][0])}
            data={result.data.polygon}
            style={{
              color: "#2980b9",
              fillColor: "#3498db",
              weight: 2,
              fillOpacity: 0.3,
            }}
          />
          <CircleMarker
            center={result.data.center}
            radius={9}
            pathOptions={{
              color: "#e74c3c",
              fillColor: "#e74c3c",
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              <b>{label}</b>
              <br />
              {result.data.center[0].toFixed(4)},{" "}
              {result.data.center[1].toFixed(4)}
              <br />
              {result.data.distanceKm} km · {result.data.areaKm2.toFixed(2)} km²
            </Popup>
          </CircleMarker>
          <FitBounds result={result} />
        </>
      )}

      {/* ========== ROUTE ========== */}
      {result?.type === "route" && (
        <>
          <Polyline
            positions={result.data.coordinates}
            pathOptions={{
              color: "#0077b6",
              weight: 5,
              opacity: 0.85,
            }}
          />

          {/* Start marker */}
          <Marker position={result.data.start}>
            <Popup>
              <b>Start</b>
              <br />
              {result.data.start[0].toFixed(4)},{" "}
              {result.data.start[1].toFixed(4)}
            </Popup>
          </Marker>

          {/* End marker */}
          <Marker position={result.data.end}>
            <Popup>
              <b>Destination</b>
              <br />
              {result.data.end[0].toFixed(4)}, {result.data.end[1].toFixed(4)}
            </Popup>
          </Marker>

          <FitBounds result={result} />
        </>
      )}
    </MapContainer>
  );
}
