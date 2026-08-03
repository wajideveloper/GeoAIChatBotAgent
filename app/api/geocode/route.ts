import { NextRequest, NextResponse } from "next/server";
import { geocodeCache, makeCacheKey } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const cacheKey = makeCacheKey("geocode", q);

  // 1. Check cache first
  const cached = geocodeCache.get<{
    lat: number;
    lon: number;
    display_name: string;
  }>(cacheKey);

  if (cached) {
    console.log("💾 [GEOCODE] Cache HIT →", q);
    return NextResponse.json({ ...cached, cached: true });
  }
  console.log("🔄 [GEOCODE] Cache MISS → calling Nominatim...")

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "MyGeoChatApp/1.0 (wshahgis111@gmail.com)",
        Accept: "application/json",
      },
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          error: "nominatim_blocked",
          message: "Nominatim blocked the request",
        },
        { status: 429 },
      );
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "not_found", message: `Could not find "${q}"` },
        { status: 404 },
      );
    }

    const result = {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      display_name: data[0].display_name as string,
    };

    // 2. Save to cache
    geocodeCache.set(cacheKey, result);

    return NextResponse.json({ ...result, cached: false });
  } catch (error: any) {
    console.error("Geocode error:", error);
    return NextResponse.json(
      { error: "geocode_failed", message: error.message },
      { status: 500 },
    );
  }
}
