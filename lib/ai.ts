// lib/ai.ts
import { OpenAI } from "openai";

interface AICommandResponse {
  intent: 'clean_data' | 'build_report' | 'unknown';
  parameters: Record<string, any>;
  confidence: number;
  message: string; // Add natural language response
}

export async function interpretCommand(command: string, context: any): Promise<AICommandResponse> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set, using mock AI");
    return { 
      intent: 'clean_data', 
      parameters: { trim: true }, 
      confidence: 0.9,
      message: "I've analyzed your request and am ready to clean your data. Please provide the sheet URL in the Pipeline section."
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Real implementation would use openai.chat.completions.create
  return { 
    intent: 'clean_data', 
    parameters: { trim: true }, 
    confidence: 0.9,
    message: `I've received your command: "${command}". I'm setting up the cleaning pipeline for you now.`
  };
}



