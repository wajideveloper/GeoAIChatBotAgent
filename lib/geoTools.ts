import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";

export interface BufferResult {
  polygon: Feature<Polygon>;
  center: [number, number]; // [lat, lon]
  areaKm2: number;
  distanceKm: number;
}

export function createBuffer(
  lat: number,
  lon: number,
  distanceKm: number,
): BufferResult {
  const pt = turf.point([lon, lat]); // GeoJSON is [lon, lat]
  const polygon = turf.buffer(pt, distanceKm, {
    units: "kilometers",
    steps: 64,
  }) as Feature<Polygon>;

  return {
    polygon,
    center: [lat, lon],
    areaKm2: turf.area(polygon) / 1_000_000,
    distanceKm,
  };
}
