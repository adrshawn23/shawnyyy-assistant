// lib/ai.ts
import { OpenAI } from "openai";

interface AICommandResponse {
  intent: 'clean_data' | 'build_report' | 'unknown';
  parameters: Record<string, any>;
  confidence: number;
  message: string;
}

export async function interpretCommand(command: string, context: any): Promise<AICommandResponse> {
  // Use a safer mock if OPENAI_API_KEY is missing, but make sure it always returns all fields
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set, using mock AI");
    return { 
      intent: 'clean_data', 
      parameters: { trim: true }, 
      confidence: 0.9,
      message: "I've analyzed your request and am ready to clean your data. Please provide the sheet URL in the Pipeline section."
    };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Placeholder for actual API call
    return { 
      intent: 'clean_data', 
      parameters: { trim: true }, 
      confidence: 0.9,
      message: `I've received your command: "${command}". I'm setting up the cleaning pipeline for you now.`
    };
  } catch (error) {
    console.error("AI Error:", error);
    return { 
      intent: 'unknown', 
      parameters: {}, 
      confidence: 0,
      message: "Sorry, I encountered an error while processing your request."
    };
  }
}



