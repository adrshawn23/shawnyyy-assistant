// lib/ai.ts
import { OpenAI } from "openai";

interface AICommandResponse {
  intent: 'clean_data' | 'build_report' | 'unknown';
  parameters: Record<string, any>;
  confidence: number;
}

export async function interpretCommand(command: string, context: any): Promise<AICommandResponse> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set, using mock AI");
    return { intent: 'clean_data', parameters: { trim: true }, confidence: 0.9 };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Real implementation would look like:
  // const completion = await openai.chat.completions.create({
  //   model: "gpt-4o",
  //   messages: [{ role: "user", content: `Interpret this command: ${command}` }],
  //   response_format: { type: "json_object" }
  // });
  
  return { intent: 'clean_data', parameters: { trim: true }, confidence: 0.9 };
}



