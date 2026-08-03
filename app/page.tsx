"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { parseQuery } from "@/lib/parseQuery";
import { createBuffer, type BufferResult } from "@/lib/geoTools";
import { fetchRoute } from "@/lib/routing";

const GeoMap = dynamic(() => import("../component/GeoMap"), { ssr: false });

export default function Home() {
  const [puter, setPuter] = useState<any>(null);

  // Chat state
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [model, setModel] = useState("claude-sonnet-5");
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  // Map state
  const [mapResult, setMapResult] = useState<BufferResult | null>(null);
  const [mapLabel, setMapLabel] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Puter
  useEffect(() => {
    import("@heyputer/puter.js").then((module) => {
      setPuter(module.puter);
    });
  }, []);

  // Create first chat
  useEffect(() => {
    if (sessions.length === 0) handleNewChat();
  }, []);

  const activeChat = sessions.find((s) => s.id === currentChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, loading]);

  const handleNewChat = () => {
    const newSession = {
      id: Date.now().toString(),
      title: "New Chat",
      model,
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentChatId(newSession.id);
    setMapResult(null);
    setMapLabel("");
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || loading || !currentChatId || !puter) return;

    const userMessage = inputPrompt.trim();
    setInputPrompt("");
    setLoading(true);

    // 1. Add user message
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== currentChatId) return s;
        const updatedMessages = [
          ...s.messages,
          { role: "user", content: userMessage },
        ];
        const updatedTitle =
          s.messages.length === 0
            ? userMessage.slice(0, 28) + (userMessage.length > 28 ? "…" : "")
            : s.title;
        return { ...s, title: updatedTitle, messages: updatedMessages };
      }),
    );

    try {
      // 1. Parse the query with Mistral
      const params = await parseQuery(userMessage);

      // 2. Spatial query → buffer analysis
      // ========== BUFFER ==========
      if (params.intent === "buffer_analysis" && params.location_name) {
        const geoRes = await fetch(
          `/api/geocode?q=${encodeURIComponent(params.location_name)}`,
        );
        const geo = await geoRes.json();

        if (geo.error || !geo.lat) {
          appendAssistantMessage(`I couldn't find "${params.location_name}".`);
          return;
        }

        const distanceKm = params.distance_km ?? 1;
        const buffer = createBuffer(geo.lat, geo.lon, distanceKm);

        // ★★★ THIS LINE IS THE MOST IMPORTANT ★★★
        setMapResult({
          type: "buffer",
          data: buffer,
        });

        setMapLabel(geo.display_name || params.location_name);

        appendAssistantMessage(
          `Here's a **${distanceKm} km** buffer around **${geo.display_name || params.location_name}**.\n` +
            `📍 ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}\n` +
            `📊 Area ≈ ${buffer.areaKm2.toFixed(2)} km²`,
        );
        return;
      }

      // ========== ROUTING ==========
      if (params.intent === "routing" && params.from && params.to) {
        try {
          // 1. Geocode start
          const fromRes = await fetch(
            `/api/geocode?q=${encodeURIComponent(params.from)}`,
          );
          const fromGeo = await fromRes.json();
          if (fromGeo.error) {
            appendAssistantMessage(
              `I couldn't find the starting place: "${params.from}"`,
            );
            return;
          }

          // 2. Geocode end
          const toRes = await fetch(
            `/api/geocode?q=${encodeURIComponent(params.to)}`,
          );
          const toGeo = await toRes.json();
          if (toGeo.error) {
            appendAssistantMessage(
              `I couldn't find the destination: "${params.to}"`,
            );
            return;
          }

          // 3. Get the route
          const mode = params.mode || "driving";
          const route = await fetchRoute(
            { lat: fromGeo.lat, lng: fromGeo.lon },
            { lat: toGeo.lat, lng: toGeo.lon },
            mode,
          );

          if (!route) {
            appendAssistantMessage(
              "Sorry, I couldn't find a route between these places.",
            );
            return;
          }

          // 4. Show on map
          setMapResult({
            type: "route",
            data: {
              coordinates: route.coordinates,
              start: [fromGeo.lat, fromGeo.lon],
              end: [toGeo.lat, toGeo.lon],
              mode,
            },
          });

          // 5. Reply to user
          const distanceKm = (route.distance / 1000).toFixed(1);
          const durationMin = Math.round(route.duration / 60);

          appendAssistantMessage(
            `Here's the **${mode}** route from **${params.from}** to **${params.to}**:\n` +
              `📏 Distance: ${distanceKm} km\n` +
              `⏱️ Duration: about ${durationMin} minutes`,
          );
        } catch (err: any) {
          appendAssistantMessage(`Routing failed: ${err.message}`);
        }
        return;
      }

      // 3. Normal chat → call Mistral
      const currentMessages = activeChat?.messages ?? [];
      const conversationHistory = [
        ...currentMessages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ];

      // Add empty assistant message (for loading feel)
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentChatId) return s;
          return {
            ...s,
            messages: [...s.messages, { role: "assistant", content: "" }],
          };
        }),
      );

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral-small-latest", // or "mistral-large-latest", "mistral-medium-latest"
          messages: conversationHistory,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Fill the last assistant message
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentChatId) return s;
          const msgs = [...s.messages];
          msgs[msgs.length - 1] = {
            role: "assistant",
            content: data.content,
          };
          return { ...s, messages: msgs };
        }),
      );
    } catch (err: any) {
      console.error(err);
      appendAssistantMessage(
        `⚠️ Error: ${err.message || "Something went wrong"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // Helper to append a finished assistant message
  function appendAssistantMessage(text: string) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== currentChatId) return s;
        return {
          ...s,
          messages: [...s.messages, { role: "assistant", content: text }],
        };
      }),
    );
  }

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden">
      {/* ========== LEFT SIDEBAR + CHAT ========== */}
      <div className="w-[380px] flex flex-col border-r border-gray-200 bg-gray-50">
        {/* Sidebar header + new chat */}
        <div className="p-3 border-b border-gray-200 bg-white">
          <button
            onClick={handleNewChat}
            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            + New Chat
          </button>
        </div>

        {/* Chat list (compact) */}
        <div className="max-h-32 overflow-y-auto border-b border-gray-200 bg-white px-2 py-2 space-y-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                setCurrentChatId(session.id);
                // optionally clear map when switching chats
              }}
              className={`w-full text-left py-1.5 px-2 rounded text-xs truncate ${
                session.id === currentChatId
                  ? "bg-blue-100 text-blue-800 font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {session.title}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeChat?.messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Ask for a buffer, e.g. “2 km around Times Square”
            </div>
          ) : (
            activeChat?.messages.map((msg: any, idx: number) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white border border-gray-200 shadow-sm rounded-bl-none"
                  }`}
                >
                  {msg.content ||
                    (loading && idx === activeChat.messages.length - 1
                      ? "…"
                      : "")}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <textarea
              rows={1}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="2 km around Times Square…"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !inputPrompt.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* ========== CENTER MAP ========== */}
      <div className="flex-1 relative">
        <GeoMap result={mapResult} label={mapLabel} />

        {/* Optional floating model selector */}
        <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur rounded-lg shadow px-3 py-2 flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-sm border-none bg-transparent focus:outline-none"
          >
            <option value="claude-sonnet-5">Claude Sonnet 5</option>
            <option value="claude-opus-5">Claude Opus 5</option>
            <option value="claude-opus-5-fast">Claude Opus 5 Fast</option>
            <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
            <option value="claude-fable-5">Claude Fable 5</option>
            <option value="openai/gpt-5.4-nano">open AI</option>
          </select>
        </div>
      </div>
    </div>
  );
}
