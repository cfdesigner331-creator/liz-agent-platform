import OpenAI from "openai";

export interface ChatMessage {
  role: string;
  content: string;
}

interface ProviderOptions {
  aiProvider?: string; // "openai" | "groq"
  openaiApiKey?: string;
  openaiModel?: string;
  groqApiKey?: string;
  groqModel?: string;
}

export async function generateResponse(
  messages: ChatMessage[],
  systemPrompt: string,
  temperature: number,
  maxTokens: number,
  providerOpts?: ProviderOptions
): Promise<{ content: string; tokens: number }> {
  const provider = providerOpts?.aiProvider || "openai";
  
  let client: OpenAI;
  let modelName: string;

  if (provider === "groq") {
    const apiKey = providerOpts?.groqApiKey || process.env.GROQ_API_KEY || "";
    modelName = providerOpts?.groqModel || "llama-3.3-70b-versatile";
    
    client = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  } else {
    // OpenAI provider
    const apiKey = providerOpts?.openaiApiKey || process.env.OPENAI_API_KEY || "";
    modelName = providerOpts?.openaiModel || "gpt-4.1-mini";

    client = new OpenAI({
      apiKey: apiKey,
    });
  }

  try {
    const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(msg => ({
        role: (msg.role === "model" || msg.role === "assistant") ? "assistant" as const : "user" as const,
        content: msg.content,
      })),
    ];

    const response = await client.chat.completions.create({
      model: modelName,
      messages: formattedMessages,
      temperature: temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content || "";
    const tokens = response.usage?.total_tokens || 0;

    return { content, tokens };
  } catch (err: any) {
    console.error(`[AI Provider Error] Falha na chamada da IA (${provider}):`, err.message);
    throw new Error(`Falha na IA (${provider}): ${err.message}`);
  }
}
