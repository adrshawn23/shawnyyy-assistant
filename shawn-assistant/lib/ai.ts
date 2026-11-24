import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AICommandResponse {
  intent: 'clean_data' | 'build_report' | 'unknown';
  parameters: Record<string, any>;
  confidence: number;
}

export async function interpretCommand(command: string, context: any): Promise<AICommandResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are Shawn, an AI assistant for Google Sheets operations. Parse the user command into a JSON object with intent (clean_data, build_report, or unknown), parameters, and confidence.'
        },
        { role: 'user', content: command }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      intent: result.intent || 'unknown',
      parameters: result.parameters || {},
      confidence: result.confidence || 0
    };
  } catch (error) {
    console.error('AI Interpretation Error:', error);
    return { intent: 'unknown', parameters: {}, confidence: 0 };
  }
}
