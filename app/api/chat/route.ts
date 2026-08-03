import { NextRequest, NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { messages, model = "mistral-small-latest" } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 },
      );
    }

    const response = await client.chat.complete({
      model,
      messages,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content ?? "";

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error("Mistral error:", error);
    return NextResponse.json(
      { error: error.message || "Mistral API failed" },
      { status: 500 },
    );
  }
}
