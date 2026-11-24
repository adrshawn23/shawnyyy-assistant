import { OpenAI } from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI API Key not configured" }, { status: 500 });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are Shawn, a helpful, futuristic AI assistant for company Google Sheets operations. Keep your tone professional, efficient, and slightly futuristic." },
      ...messages
    ],
  });

  return NextResponse.json({ response: completion.choices[0].message.content });
}
