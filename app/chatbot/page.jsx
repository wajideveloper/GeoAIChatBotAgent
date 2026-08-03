"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [puter, setPuter] = useState < any > null;
  const [prompt, setPrompt] = useState("Write a short poem about coding");
  const [model, setModel] = useState("claude-sonnet-5");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize Puter client-side
  useEffect(() => {
    import("@heyputer/puter.js").then((module) => {
      setPuter(module.puter);
    });
  }, []);

  const handleGenerate = async () => {
    if (!puter) {
      alert("Puter.js is still loading, please wait a moment...");
      return;
    }

    setLoading(true);
    setOutput("");

    try {
      // Use streaming response
      const response = await puter.ai.chat(prompt, {
        model: model,
        stream: true,
      });

      for await (const part of response) {
        if (part?.text) {
          setOutput((prev) => prev + part.text);
        }
      }
    } catch (error) {
      console.error(error);
      setOutput(`Error: ${error.message || "Something went wrong."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6 font-sans">
      <h1 className="text-3xl font-bold">Puter.js + Claude Tester</h1>

      {/* Model Selection */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold">Select Model:</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="border border-gray-300 rounded p-2 text-black"
        >
          <option value="claude-sonnet-5">Claude Sonnet 5</option>
          <option value="claude-opus-5">Claude Opus 5</option>
          <option value="claude-opus-5-fast">Claude Opus 5 (Fast)</option>
          <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
          <option value="claude-fable-5">Claude Fable 5</option>
        </select>
      </div>

      {/* Prompt Input */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold">Prompt:</label>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="border border-gray-300 rounded p-3 text-black w-full"
          placeholder="Type your prompt here..."
        />
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !puter}
        className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Generating..." : "Run Prompt"}
      </button>

      {/* Output Display */}
      <div className="border border-gray-200 rounded p-4 bg-gray-50 min-h-[150px]">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">OUTPUT:</h2>
        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
          {output || (loading ? "Waiting for response..." : "No output yet.")}
        </pre>
      </div>
    </main>
  );
}
