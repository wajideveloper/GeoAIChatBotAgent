import { parseCache, makeCacheKey } from "@/lib/cache";

export interface QueryParams {
  intent: "buffer_analysis" | "routing" | "chat";

  // for buffer
  location_name?: string | null;
  distance_km?: number | null;

  // for routing
  from?: string | null;
  to?: string | null;
  mode?: "driving" | "walking" | "cycling";
}

const SYSTEM = `You are a GIS assistant. Analyze the user query and return ONLY a valid JSON object (no markdown, no explanation).

Possible intents:
1. "buffer_analysis" - when user wants a radius/area/buffer around ONE place
2. "routing" - when user wants a path/route/directions from one place to another
3. "chat" - normal conversation

For buffer_analysis return:
{
  "intent": "buffer_analysis",
  "location_name": "place name",
  "distance_km": number
}

For routing return:
{
  "intent": "routing",
  "from": "starting place",
  "to": "destination place",
  "mode": "driving" | "walking" | "cycling"
}

For normal chat return:
{
  "intent": "chat"
}

Rules:
- Convert miles to km (1 mile = 1.609)
- Convert meters to km
- If mode is not mentioned in a routing question, use "driving"
`;

export async function parseQuery(userQuery: string): Promise<QueryParams> {
  const cacheKey = makeCacheKey("parse", userQuery);

  // 1. Check cache first
  const cached = parseCache.get<QueryParams>(cacheKey);
  if (cached) {
    console.log("💾 [PARSE] Cache HIT →", userQuery);
    return cached;
  }

  console.log("🔄 [PARSE] Cache MISS → calling AI...");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-small-latest", // or gemini
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userQuery },
        ],
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const text = (data.content || "").replace(/```json|```/g, "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);

    // 2. Save to cache
    parseCache.set(cacheKey, parsed);
    console.log("💾 Cached parse →", userQuery);

    return parsed;
  } catch {
    return regexFallback(userQuery);
  }
}

function regexFallback(q: string): QueryParams {
  // simple buffer detection
  const m = q.match(/(\d+(?:\.\d+)?)\s*(km|kilometer|mile|mi|m|meter)/i);
  let distance_km: number | null = null;
  if (m) {
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    distance_km = u.startsWith("mi")
      ? n * 1.609
      : u === "m" || u === "meter"
        ? n / 1000
        : n;
  }

  const loc = q.match(
    /(?:around|near|of|from|within)\s+(?:the\s+)?([A-Z][\w\s,]+)/,
  );

  if (distance_km) {
    return {
      intent: "buffer_analysis",
      location_name: loc?.[1]?.trim() ?? null,
      distance_km,
    };
  }

  return { intent: "chat" };
}
