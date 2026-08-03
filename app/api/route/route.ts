import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { start, end, mode = "driving" } = await req.json();

    const apiKey = process.env.GRAPHHOPPER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GraphHopper API key is missing" },
        { status: 500 },
      );
    }

    const profileMap: Record<string, string> = {
      driving: "car",
      walking: "foot",
      cycling: "bike",
    };

    const body = {
      points: [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ],
      profile: profileMap[mode] || "car",
      locale: "en",
      instructions: true,
      calc_points: true,
      points_encoded: false,
    };

    const res = await fetch(
      `https://graphhopper.com/api/1/route?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `GraphHopper error: ${res.status} - ${errorText}` },
        { status: res.status },
      );
    }

    const data = await res.json();

    if (!data.paths?.[0]) {
      return NextResponse.json({ error: "No route found" }, { status: 404 });
    }

    const path = data.paths[0];

    return NextResponse.json({
      coordinates: path.points.coordinates.map(([lng, lat]: number[]) => [
        lat,
        lng,
      ]),
      distance: path.distance,
      duration: path.time / 1000,
      steps: path.instructions || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Routing failed" },
      { status: 500 },
    );
  }
}
