import { routeCache, makeCacheKey } from "@/lib/cache";

export async function fetchRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  mode: "driving" | "walking" | "cycling" = "driving",
) {
  const cacheKey = makeCacheKey(
    "route",
    start.lat.toFixed(5),
    start.lng.toFixed(5),
    end.lat.toFixed(5),
    end.lng.toFixed(5),
    mode,
  );

  const cached = routeCache.get(cacheKey);
  if (cached) {
    console.log("💾 Cache HIT: route");
    return cached;
  }

  const res = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end, mode }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Routing failed");
  }

  return data;
}
