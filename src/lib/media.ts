import { GoogleGenAI } from "@google/genai";

// ─── Types ────────────────────────────────────────────────────────────────────
export type MediaType = "audio" | "image" | "document" | null;

export interface MediaResult {
  type: MediaType;
  caption: string; // Transcrição ou descrição gerada pelo Gemini
}

// ─── Helper: PCM → WAV ───────────────────────────────────────────────────────
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const dataSize = pcmBuffer.length;
  const wavBuffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write("WAVE", 8);

  // fmt chunk
  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16); // chunk size
  wavBuffer.writeUInt16LE(1, 20);  // PCM
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  wavBuffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}

// ─── Download de Mídia da Evolution API ──────────────────────────────────────
export async function downloadMediaFromEvolution(
  evolutionUrl: string,
  evolutionApiKey: string,
  instanceId: string,
  messageKey: { id: string; remoteJid: string; fromMe: boolean }
): Promise<{ base64: string; mimetype: string } | null> {
  const cleanUrl = (evolutionUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/chat/getBase64FromMediaMessage/${instanceId.trim()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey.trim(),
      },
      body: JSON.stringify({
        message: { key: messageKey },
        convertToMp4: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Media] Falha ao baixar mídia da Evolution (${response.status}).`);
      return null;
    }

    const data = await response.json();
    const raw = data?.base64 as string | undefined;
    if (!raw) return null;

    // Remove prefixo data URI se presente
    const base64 = raw.includes(",") ? raw.split(",")[1] : raw;
    const mimetype = data?.mimetype || "application/octet-stream";

    return { base64, mimetype };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn("[Media] Erro ao baixar mídia:", err.message);
    return null;
  }
}

// ─── Transcrição de Áudio com Gemini ─────────────────────────────────────────
export async function transcribeAudioWithGemini(
  base64: string,
  mimetype: string,
  geminiApiKey: string,
  geminiModel: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [
        {
          parts: [
            {
              text: "Transcreva exatamente o que está sendo dito neste áudio em português brasileiro. Retorne apenas a transcrição literal, sem comentários ou explicações adicionais.",
            },
            {
              inlineData: { mimeType: mimetype, data: base64 },
            },
          ],
        },
      ],
    });

    return response.text?.trim() || "[Áudio não pôde ser transcrito]";
  } catch (err: any) {
    console.error("[Media] Erro ao transcrever áudio com Gemini:", err.message);
    return "[Erro ao transcrever áudio]";
  }
}

// ─── Análise de Imagem com Gemini Vision ─────────────────────────────────────
export async function analyzeImageWithGemini(
  base64: string,
  mimetype: string,
  caption: string,
  geminiApiKey: string,
  geminiModel: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const textPrompt = caption
    ? `Descreva esta imagem detalhadamente para um contexto comercial. O cliente também enviou esta legenda: "${caption}". Inclua todos os elementos visuais relevantes.`
    : "Descreva esta imagem detalhadamente para um contexto comercial. Inclua todos os elementos visuais, cores, texto visível e qualquer detalhe relevante para uma conversa de vendas/atendimento.";

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [
        {
          parts: [
            { text: textPrompt },
            { inlineData: { mimeType: mimetype, data: base64 } },
          ],
        },
      ],
    });

    return response.text?.trim() || "[Imagem não pôde ser analisada]";
  } catch (err: any) {
    console.error("[Media] Erro ao analisar imagem com Gemini:", err.message);
    return "[Erro ao analisar imagem]";
  }
}

// ─── Análise de Documento com Gemini ─────────────────────────────────────────
export async function analyzeDocumentWithGemini(
  base64: string,
  mimetype: string,
  title: string,
  geminiApiKey: string,
  geminiModel: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [
        {
          parts: [
            {
              text: `Analise este documento chamado "${title || "documento"}" e extraia as informações mais importantes em português. Informe o tipo de documento, dados principais e qualquer informação relevante para um atendimento comercial.`,
            },
            { inlineData: { mimeType: mimetype, data: base64 } },
          ],
        },
      ],
    });

    return response.text?.trim() || "[Documento não pôde ser analisado]";
  } catch (err: any) {
    console.error("[Media] Erro ao analisar documento com Gemini:", err.message);
    return "[Erro ao analisar documento]";
  }
}

// ─── Text-to-Speech com Gemini TTS ───────────────────────────────────────────
export async function generateSpeechWithGemini(
  text: string,
  geminiApiKey: string,
  ttsVoice = "Kore"
): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: ttsVoice },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const pcmBase64 = (part as any)?.inlineData?.data as string | undefined;

    if (!pcmBase64) {
      console.warn("[Media] TTS Gemini não retornou dados de áudio.");
      return null;
    }

    // PCM 24kHz mono 16-bit → WAV
    const pcmBuffer = Buffer.from(pcmBase64, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
    return wavBuffer.toString("base64");
  } catch (err: any) {
    console.error("[Media] Erro ao gerar fala com Gemini TTS:", err.message);
    return null;
  }
}

// ─── Detectar tipo de mídia no payload da Evolution API ──────────────────────
export function detectMediaType(messageContent: Record<string, any>): {
  type: MediaType;
  mimetype: string;
  caption: string;
  title: string;
  isPtt: boolean;
} {
  if (!messageContent) return { type: null, mimetype: "", caption: "", title: "", isPtt: false };

  if (messageContent.imageMessage) {
    return {
      type: "image",
      mimetype: messageContent.imageMessage.mimetype || "image/jpeg",
      caption: messageContent.imageMessage.caption || "",
      title: "",
      isPtt: false,
    };
  }

  if (messageContent.videoMessage) {
    return {
      type: "image", // Trata vídeo como imagem (analisa thumbnail/frame)
      mimetype: messageContent.videoMessage.mimetype || "video/mp4",
      caption: messageContent.videoMessage.caption || "",
      title: "",
      isPtt: false,
    };
  }

  if (messageContent.audioMessage) {
    return {
      type: "audio",
      mimetype: messageContent.audioMessage.mimetype || "audio/ogg; codecs=opus",
      caption: "",
      title: "",
      isPtt: messageContent.audioMessage.ptt === true,
    };
  }

  if (messageContent.ptvMessage) {
    return {
      type: "audio",
      mimetype: "audio/ogg; codecs=opus",
      caption: "",
      title: "",
      isPtt: true,
    };
  }

  if (messageContent.documentMessage) {
    return {
      type: "document",
      mimetype: messageContent.documentMessage.mimetype || "application/pdf",
      caption: messageContent.documentMessage.caption || "",
      title: messageContent.documentMessage.title || messageContent.documentMessage.fileName || "documento",
      isPtt: false,
    };
  }

  if (messageContent.documentWithCaptionMessage?.message?.documentMessage) {
    const doc = messageContent.documentWithCaptionMessage.message.documentMessage;
    return {
      type: "document",
      mimetype: doc.mimetype || "application/pdf",
      caption: doc.caption || "",
      title: doc.title || doc.fileName || "documento",
      isPtt: false,
    };
  }

  return { type: null, mimetype: "", caption: "", title: "", isPtt: false };
}
