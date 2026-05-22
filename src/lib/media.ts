import { GoogleGenAI } from "@google/genai";
import OpenAI, { toFile } from "openai";

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

// ─── Helper: sanitizar mimetype para Gemini ──────────────────────────────────
// WhatsApp envia "audio/ogg; codecs=opus" mas Gemini só aceita "audio/ogg"
function sanitizeMimetype(raw: string): string {
  if (!raw) return "audio/ogg";
  // Remove tudo depois do ";" (ex: "; codecs=opus")
  return raw.split(";")[0].trim().toLowerCase();
}

// ─── Transcrição de Áudio com Gemini ─────────────────────────────────────────
export async function transcribeAudioWithGemini(
  base64: string,
  mimetype: string,
  geminiApiKey: string,
  geminiModel: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const cleanMime = sanitizeMimetype(mimetype);

  // Forçar gemini-2.5-flash para transcrição de áudio, já que o flash-lite não é multimodal
  const modelToUse = "gemini-2.5-flash";

  console.log(`[Media] Transcrevendo áudio | mime: ${cleanMime} | modelo: ${modelToUse} | tamanho base64: ${base64.length} chars`);

  try {
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [
        {
          parts: [
            {
              text: "Transcreva exatamente o que está sendo dito neste áudio em português brasileiro. Retorne apenas a transcrição literal, sem comentários ou explicações adicionais.",
            },
            {
              inlineData: { mimeType: cleanMime, data: base64 },
            },
          ],
        },
      ],
    });

    const transcription = response.text?.trim();
    if (!transcription) {
      console.warn("[Media] Gemini retornou transcrição vazia.");
      return "[Áudio recebido - não foi possível transcrever]";
    }

    console.log(`[Media] Transcrição OK: "${transcription.substring(0, 80)}..."`);
    return transcription;
  } catch (err: any) {
    console.error("[Media] Erro ao transcrever áudio com Gemini:", err.message);
    // Retorna erro legível mas não quebra o fluxo
    return `[Áudio recebido - erro na transcrição: ${err.message?.substring(0, 60)}]`;
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
  const cleanMime = sanitizeMimetype(mimetype) || "image/jpeg";

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
            { inlineData: { mimeType: cleanMime, data: base64 } },
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
  const cleanMime = sanitizeMimetype(mimetype) || "application/pdf";

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [
        {
          parts: [
            {
              text: `Analise este documento chamado "${title || "documento"}" e extraia as informações mais importantes em português. Informe o tipo de documento, dados principais e qualquer informação relevante para um atendimento comercial.`,
            },
            { inlineData: { mimeType: cleanMime, data: base64 } },
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

  // Limita o texto a 4000 chars (limite do TTS)
  const safeText = text.substring(0, 4000);

  console.log(`[Media] Gerando TTS | voz: ${ttsVoice} | texto: "${safeText.substring(0, 60)}..."`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: safeText }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: ttsVoice },
          },
        },
      },
    });

    // Tenta extrair o áudio de candidates[0].content.parts[0].inlineData
    const candidate = (response as any)?.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    const inlineData = part?.inlineData;

    if (!inlineData?.data) {
      console.warn("[Media] TTS Gemini não retornou inlineData. Estrutura da resposta:", JSON.stringify({
        hasCandidates: !!(response as any)?.candidates,
        candidateCount: (response as any)?.candidates?.length,
        hasContent: !!candidate?.content,
        hasParts: !!candidate?.content?.parts,
        partType: part ? Object.keys(part) : null,
      }));
      return null;
    }

    const mimeType = inlineData.mimeType || "audio/pcm";
    const pcmBase64 = inlineData.data as string;

    console.log(`[Media] TTS OK | mime: ${mimeType} | tamanho: ${pcmBase64.length} chars`);

    // Gemini TTS retorna PCM linear 24kHz mono 16-bit → encapsula em WAV
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

/**
 * Geração de Voz realista usando a API Bytes do Cartesia AI
 */
export async function generateSpeechWithCartesia(
  text: string,
  apiKey: string,
  voiceId = "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4"
): Promise<string | null> {
  const safeText = text.substring(0, 4000);
  console.log(`[Media] Gerando Voz Cartesia | voz: ${voiceId} | texto: "${safeText.substring(0, 60)}..."`);

  try {
    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cartesia-Version": "2024-06-10",
        "X-API-Key": apiKey.trim(),
      },
      body: JSON.stringify({
        transcript: safeText,
        model_id: "sonic-multilingual",
        voice: {
          mode: "id",
          id: voiceId.trim(),
        },
        output_format: {
          container: "wav",
          encoding: "pcm_s16le",
          sample_rate: 24000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Media] Erro Cartesia API (${response.status}): ${errorText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    // Como o Cartesia com output_format container 'wav' já encapsula nativamente
    // os headers RIFF/WAVE no buffer retornado, convertemos diretamente para base64.
    return audioBuffer.toString("base64");
  } catch (err: any) {
    console.error("[Media] Falha ao gerar fala com Cartesia TTS:", err.message);
    return null;
  }
}

/**
 * Orquestrador unificado para geração de áudios TTS
 */
export async function generateSpeech(
  text: string,
  config: {
    ttsProvider?: string;
    geminiApiKey?: string;
    ttsVoice?: string;
    cartesiaApiKey?: string;
    cartesiaVoiceId?: string;
  }
): Promise<string | null> {
  const provider = config.ttsProvider || "gemini";

  if (provider === "cartesia") {
    const apiKey = config.cartesiaApiKey || "sk_car_3yj7jJ1y5HpBhDNRGfBvHG";
    const voiceId = config.cartesiaVoiceId || "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4";
    if (!apiKey) {
      console.warn("[Media] Provedor de voz definido como Cartesia, mas chave de API está ausente.");
      return null;
    }
    return generateSpeechWithCartesia(text, apiKey, voiceId);
  } else {
    // Gemini
    const apiKey = config.geminiApiKey;
    const voice = config.ttsVoice || "Kore";
    if (!apiKey) {
      console.warn("[Media] Provedor de voz definido como Gemini, mas chave de API do Gemini está ausente.");
      return null;
    }
    return generateSpeechWithGemini(text, apiKey, voice);
  }
}

// ─── Helper: obter extensão de áudio a partir do mimetype ────────────────────
function getAudioExtension(mimetype: string): string {
  const mime = mimetype.toLowerCase();
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("webm")) return "webm";
  return "ogg";
}

// ─── Transcrição de Áudio com OpenAI Whisper ─────────────────────────────────
export async function transcribeAudioWithOpenAI(
  base64: string,
  mimetype: string,
  apiKey: string
): Promise<string> {
  const openai = new OpenAI({ apiKey: apiKey.trim() });
  const cleanMime = sanitizeMimetype(mimetype);
  const extension = getAudioExtension(cleanMime);

  console.log(`[Media] Transcrevendo áudio | mime: ${cleanMime} | modelo: whisper-1 | tamanho base64: ${base64.length} chars`);

  try {
    const file = await toFile(Buffer.from(base64, "base64"), `audio.${extension}`, { type: cleanMime });
    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt",
    });

    const transcription = response.text?.trim();
    if (!transcription) {
      console.warn("[Media] OpenAI Whisper retornou transcrição vazia.");
      return "[Áudio recebido - não foi possível transcrever]";
    }

    console.log(`[Media] Transcrição OpenAI Whisper OK: "${transcription.substring(0, 80)}..."`);
    return transcription;
  } catch (err: any) {
    console.error("[Media] Erro ao transcrever áudio com OpenAI Whisper:", err.message);
    throw err;
  }
}

// ─── Análise de Imagem com OpenAI Vision (GPT-4o / GPT-4o-mini) ───────────────
export async function analyzeImageWithOpenAI(
  base64: string,
  mimetype: string,
  caption: string,
  apiKey: string,
  model = "gpt-4o-mini"
): Promise<string> {
  const openai = new OpenAI({ apiKey: apiKey.trim() });
  const cleanMime = sanitizeMimetype(mimetype) || "image/jpeg";
  const dataUrl = `data:${cleanMime};base64,${base64}`;

  const textPrompt = caption
    ? `Descreva esta imagem detalhadamente para um contexto comercial. O cliente também enviou esta legenda: "${caption}". Inclua todos os elementos visuais relevantes.`
    : "Descreva esta imagem detalhadamente para um contexto comercial. Inclua todos os elementos visuais, cores, texto visível e qualquer detalhe relevante para uma conversa de vendas/atendimento.";

  console.log(`[Media] Analisando imagem com OpenAI | mime: ${cleanMime} | modelo: ${model} | prompt: "${textPrompt.substring(0, 60)}..."`);

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: textPrompt },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    });

    const description = response.choices[0]?.message?.content?.trim();
    return description || "[Imagem não pôde ser analisada]";
  } catch (err: any) {
    console.error("[Media] Erro ao analisar imagem com OpenAI:", err.message);
    throw err;
  }
}

// ─── Orquestrador Híbrido Resiliente: Transcrição ──────────────────────────
export async function transcribeAudio(
  base64: string,
  mimetype: string,
  config: {
    transcriptionProvider?: string;
    geminiApiKey?: string;
    geminiModel?: string;
    openaiApiKey?: string;
  }
): Promise<string> {
  const provider = config.transcriptionProvider || "gemini";

  if (provider === "openai") {
    if (config.openaiApiKey) {
      try {
        return await transcribeAudioWithOpenAI(base64, mimetype, config.openaiApiKey);
      } catch (err: any) {
        console.warn("[Media] Falha na transcrição com OpenAI Whisper, tentando fallback para Gemini...", err.message);
        if (config.geminiApiKey) {
          return await transcribeAudioWithGemini(base64, mimetype, config.geminiApiKey, config.geminiModel || "gemini-2.5-flash");
        }
      }
    }
  } else {
    if (config.geminiApiKey) {
      try {
        return await transcribeAudioWithGemini(base64, mimetype, config.geminiApiKey, config.geminiModel || "gemini-2.5-flash");
      } catch (err: any) {
        console.warn("[Media] Falha na transcrição com Gemini, tentando fallback para OpenAI Whisper...", err.message);
        if (config.openaiApiKey) {
          return await transcribeAudioWithOpenAI(base64, mimetype, config.openaiApiKey);
        }
      }
    }
  }

  return "[Áudio recebido - sem provedor de transcrição disponível ou credenciais inválidas]";
}

// ─── Orquestrador Híbrido Resiliente: Análise de Imagem ─────────────────────
export async function analyzeImage(
  base64: string,
  mimetype: string,
  caption: string,
  config: {
    visionProvider?: string;
    geminiApiKey?: string;
    geminiModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
  }
): Promise<string> {
  const provider = config.visionProvider || "gemini";

  if (provider === "openai") {
    if (config.openaiApiKey) {
      try {
        return await analyzeImageWithOpenAI(base64, mimetype, caption, config.openaiApiKey, config.openaiModel || "gpt-4o-mini");
      } catch (err: any) {
        console.warn("[Media] Falha na análise de imagem com OpenAI, tentando fallback para Gemini...", err.message);
        if (config.geminiApiKey) {
          return await analyzeImageWithGemini(base64, mimetype, caption, config.geminiApiKey, config.geminiModel || "gemini-2.5-flash");
        }
      }
    }
  } else {
    if (config.geminiApiKey) {
      try {
        return await analyzeImageWithGemini(base64, mimetype, caption, config.geminiApiKey, config.geminiModel || "gemini-2.5-flash");
      } catch (err: any) {
        console.warn("[Media] Falha na análise de imagem com Gemini, tentando fallback para OpenAI...", err.message);
        if (config.openaiApiKey) {
          return await analyzeImageWithOpenAI(base64, mimetype, caption, config.openaiApiKey, config.openaiModel || "gpt-4o-mini");
        }
      }
    }
  }

  return "[Imagem recebida - sem provedor de visão disponível ou credenciais inválidas]";
}

// ─── Orquestrador Híbrido Resiliente: Análise de Documento ──────────────────
export async function analyzeDocument(
  base64: string,
  mimetype: string,
  title: string,
  config: {
    visionProvider?: string;
    geminiApiKey?: string;
    geminiModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
  }
): Promise<string> {
  const provider = config.visionProvider || "gemini";

  if (provider === "openai") {
    // Se for PDF, o Gemini é absurdamente melhor. Tenta Gemini primeiro se houver chave.
    const isPdf = mimetype.toLowerCase().includes("pdf");
    if (isPdf && config.geminiApiKey) {
      try {
        return await analyzeDocumentWithGemini(base64, mimetype, title, config.geminiApiKey, config.geminiModel || "gemini-2.5-flash");
      } catch (err: any) {
        console.warn("[Media] Falha ao ler PDF com Gemini, tentando fallback de imagem se aplicável...", err.message);
      }
    }

    if (config.openaiApiKey) {
      try {
        const isImage = mimetype.toLowerCase().includes("image") || mimetype.toLowerCase().includes("png") || mimetype.toLowerCase().includes("jpeg");
        if (isImage) {
          return await analyzeImageWithOpenAI(base64, mimetype, `Documento: ${title}`, config.openaiApiKey, config.openaiModel || "gpt-4o-mini");
        }
        return `[Documento recebido: ${title} - leitura direta pelo OpenAI indisponível sem Gemini]`;
      } catch (err: any) {
        console.warn("[Media] Falha na análise com OpenAI...", err.message);
      }
    }
  } else {
    // Gemini first
    if (config.geminiApiKey) {
      try {
        return await analyzeDocumentWithGemini(base64, mimetype, title, config.geminiApiKey, config.geminiModel || "gemini-2.5-flash");
      } catch (err: any) {
        console.warn("[Media] Falha na análise do Gemini, tentando fallback para OpenAI...", err.message);
        if (config.openaiApiKey) {
          const isImage = mimetype.toLowerCase().includes("image") || mimetype.toLowerCase().includes("png") || mimetype.toLowerCase().includes("jpeg");
          if (isImage) {
            return await analyzeImageWithOpenAI(base64, mimetype, `Documento: ${title}`, config.openaiApiKey, config.openaiModel || "gpt-4o-mini");
          }
        }
      }
    }
  }

  return "[Documento recebido - sem provedor de análise de documento disponível ou credenciais inválidas]";
}
