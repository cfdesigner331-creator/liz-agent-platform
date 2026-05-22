import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/lib/openai";
import {
  sendWhatsAppMessage,
  sendWhatsAppAudio,
  sendWhatsAppPresence,
  markWhatsAppMessageAsRead,
} from "@/lib/evolution";
import {
  detectMediaType,
  downloadMediaFromEvolution,
  transcribeAudioWithGemini,
  analyzeImageWithGemini,
  analyzeDocumentWithGemini,
  generateSpeech,
} from "@/lib/media";

// Cache estático de mensagens em processamento concorrente para desduplicação
const activeMessageIds = new Set<string>();

export async function POST(req: Request) {
  let messageIdToClean: string | null = null;
  try {
    const body = await req.json();
    const { event, data } = body;

    // 1. Ignorar se o evento for diferente de messages.upsert
    if (event !== "messages.upsert") {
      return NextResponse.json({ ok: true, ignored: "evento_nao_suportado" });
    }

    if (!data || !data.key || !data.key.remoteJid || !data.key.id) {
      return NextResponse.json({ ok: true, ignored: "payload_incompleto" });
    }

    const { remoteJid, fromMe, id: messageId } = data.key;

    // 2. Ignorar mensagens enviadas por nós mesmos
    if (fromMe === true) {
      return NextResponse.json({ ok: true, ignored: "mensagem_propria" });
    }

    // 3. Ignorar grupos
    if (remoteJid.includes("@g.us")) {
      return NextResponse.json({ ok: true, ignored: "mensagem_grupo" });
    }

    // 3.1. Evitar duplicados (Desduplicação e Idempotência)
    // Camada 1: Em memória (In-Flight Concorrente)
    if (activeMessageIds.has(messageId)) {
      console.log(`[Webhook] Ignorando mensagem concorrente (em processamento): ${messageId}`);
      return NextResponse.json({ ok: true, ignored: "duplicado_in_flight", messageId });
    }

    // Camada 2: Histórico definitivo no Banco (SQLite)
    const existingMsg = await prisma.message.findUnique({
      where: { id: messageId }
    });
    if (existingMsg) {
      console.log(`[Webhook] Ignorando mensagem duplicada (já processada e salva): ${messageId}`);
      return NextResponse.json({ ok: true, ignored: "duplicado_db", messageId });
    }

    // Registrar no cache concorrente
    activeMessageIds.add(messageId);
    messageIdToClean = messageId;

    // Prevenção de vazamento de memória (Memory Leak Limit)
    if (activeMessageIds.size > 1000) {
      activeMessageIds.clear();
    }

    const phone = remoteJid.replace("@s.whatsapp.net", "");
    const messageContent = data.message;

    // 4. Detectar tipo de mídia
    const mediaInfo = detectMediaType(messageContent || {});

    // 5. Extrair texto da mensagem (texto puro)
    let userMessageText = "";
    if (messageContent) {
      if (messageContent.conversation) {
        userMessageText = messageContent.conversation;
      } else if (messageContent.extendedTextMessage?.text) {
        userMessageText = messageContent.extendedTextMessage.text;
      }
    }

    // 6. Carregar config do SQLite
    const config = await prisma.agentConfig.findFirst();
    if (!config || config.enabled === false) {
      return NextResponse.json({ ok: true, ignored: "agente_desativado" });
    }

    // 6.1. Verificar Horário de Atendimento (Schedule)
    if ((config as any).scheduleEnabled) {
      const timezone = (config as any).scheduleTimezone || "America/Sao_Paulo";
      
      // Obter data/hora atual no timezone configurado
      let nowInTz: Date;
      try {
        const options = { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false } as const;
        const formatter = new Intl.DateTimeFormat("en-US", options);
        const parts = formatter.formatToParts(new Date());
        
        const getVal = (type: string) => parts.find(p => p.type === type)!.value;
        const year = getVal("year");
        const month = getVal("month");
        const day = getVal("day");
        const hour = getVal("hour");
        const minute = getVal("minute");
        const second = getVal("second");
        
        nowInTz = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
      } catch (err) {
        console.error("[Webhook] Erro ao computar timezone, usando local:", err);
        nowInTz = new Date();
      }

      const currentDay = nowInTz.getDay(); // 0 = Domingo, 1 = Segunda, etc.
      const currentHours = nowInTz.getHours();
      const currentMinutes = nowInTz.getMinutes();
      const currentTimeMinutes = currentHours * 60 + currentMinutes;

      const mode = (config as any).scheduleMode || "normal";

      if (mode === "plantao") {
        // Modo Plantão / Pós-Horário: Silenciado nos horários comerciais de segunda a sexta (humanos atendendo)
        const isWeekday = currentDay >= 1 && currentDay <= 5;
        if (isWeekday) {
          // Parse janela 1 (Manhã, ex: "07:30" às "12:00")
          let pStartMinutes1 = 7 * 60 + 30;
          const pStartParts1 = ((config as any).schedulePlantaoStart1 || "07:30").split(":");
          if (pStartParts1.length === 2) {
            pStartMinutes1 = parseInt(pStartParts1[0]) * 60 + parseInt(pStartParts1[1]);
          }

          let pEndMinutes1 = 12 * 60;
          const pEndParts1 = ((config as any).schedulePlantaoEnd1 || "12:00").split(":");
          if (pEndParts1.length === 2) {
            pEndMinutes1 = parseInt(pEndParts1[0]) * 60 + parseInt(pEndParts1[1]);
          }

          // Parse janela 2 (Tarde, ex: "13:00" às "17:30")
          let pStartMinutes2 = 13 * 60;
          const pStartParts2 = ((config as any).schedulePlantaoStart2 || "13:00").split(":");
          if (pStartParts2.length === 2) {
            pStartMinutes2 = parseInt(pStartParts2[0]) * 60 + parseInt(pStartParts2[1]);
          }

          let pEndMinutes2 = 17 * 60 + 30;
          const pEndParts2 = ((config as any).schedulePlantaoEnd2 || "17:30").split(":");
          if (pEndParts2.length === 2) {
            pEndMinutes2 = parseInt(pEndParts2[0]) * 60 + parseInt(pEndParts2[1]);
          }

          const inWindow1 = currentTimeMinutes >= pStartMinutes1 && currentTimeMinutes <= pEndMinutes1;
          const inWindow2 = currentTimeMinutes >= pStartMinutes2 && currentTimeMinutes <= pEndMinutes2;

          if (inWindow1 || inWindow2) {
            console.log(`[Webhook] Silenciador Plantão: Humanos atendendo. Dia: ${currentDay}, Hora: ${currentHours}:${currentMinutes}. Bot ignorado.`);
            return NextResponse.json({ ok: true, ignored: "silenciador_plantao_humanos" });
          }
        }
        // Fins de semana e horários fora das janelas (ex: almoço e noites) -> bot atende normalmente
      } else {
        // Modo Comercial Tradicional
        let allowedDays: number[] = [1, 2, 3, 4, 5];
        try {
          allowedDays = JSON.parse((config as any).scheduleDays || "[1,2,3,4,5]");
        } catch (e) {
          console.error("[Webhook] Erro ao parsear scheduleDays:", e);
        }

        let startMinutes = 8 * 60; // 08:00
        const startParts = ((config as any).scheduleStartTime || "08:00").split(":");
        if (startParts.length === 2) {
          startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        }

        let endMinutes = 18 * 60; // 18:00
        const endParts = ((config as any).scheduleEndTime || "18:00").split(":");
        if (endParts.length === 2) {
          endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        }

        const isDayAllowed = allowedDays.includes(currentDay);
        const isTimeAllowed = currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;

        if (!isDayAllowed || !isTimeAllowed) {
          console.log(`[Webhook] Fora do expediente. Dia: ${currentDay}, Hora: ${currentHours}:${currentMinutes}. Enviando mensagem de ausência.`);
          if (config.evolutionUrl && config.evolutionApiKey && config.instanceId) {
            await sendWhatsAppMessage(
              config.evolutionUrl,
              config.evolutionApiKey,
              config.instanceId,
              remoteJid,
              (config as any).scheduleOffMessage || "Olá! No momento estou fora do horário de atendimento. Em breve retornarei! 😊"
            );
          }
          return NextResponse.json({ ok: true, ignored: "fora_de_horario" });
        }
      }
    }

    // 7. Verificar allowedPhones
    if (config.allowedPhones && config.allowedPhones.trim() !== "") {
      const allowedList = config.allowedPhones
        .split(",")
        .map(p => (p || "").trim().replace("+", ""));
      const cleanPhone = (phone || "").replace("+", "");
      const isAllowed = allowedList.some(allowed => cleanPhone.includes(allowed));
      if (!isAllowed) {
        return NextResponse.json({ ok: true, ignored: "telefone_nao_permitido" });
      }
    }

    // Iniciar simulação de digitação imediata enquanto a IA processa o prompt e o histórico
    if (config.evolutionUrl && config.evolutionApiKey && config.instanceId) {
      await sendWhatsAppPresence(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.instanceId,
        remoteJid,
        "composing"
      );
    }

    // 8. Se for mídia — baixar e processar com Gemini
    let mediaCaption = "";
    let detectedMediaType = mediaInfo.type;
    let isAudioMessage = false;

    if (mediaInfo.type && config.geminiApiKey) {
      console.log(`[Webhook] Mídia detectada: ${mediaInfo.type} (${mediaInfo.mimetype})`);

      const mediaData = await downloadMediaFromEvolution(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.instanceId,
        data.key
      );

      if (mediaData) {
        if (mediaInfo.type === "audio") {
          isAudioMessage = true;
          mediaCaption = await transcribeAudioWithGemini(
            mediaData.base64,
            mediaData.mimetype,
            config.geminiApiKey,
            config.geminiModel
          );
          console.log(`[Webhook] Transcrição: ${mediaCaption.substring(0, 80)}...`);
        } else if (mediaInfo.type === "image") {
          mediaCaption = await analyzeImageWithGemini(
            mediaData.base64,
            mediaData.mimetype,
            mediaInfo.caption,
            config.geminiApiKey,
            config.geminiModel
          );
        } else if (mediaInfo.type === "document") {
          mediaCaption = await analyzeDocumentWithGemini(
            mediaData.base64,
            mediaData.mimetype,
            mediaInfo.title,
            config.geminiApiKey,
            config.geminiModel
          );
        }
      }
    }

    // 9. Montar texto final do usuário para o histórico e para a IA
    let effectiveUserText = userMessageText.trim();

    if (mediaInfo.type === "audio" && mediaCaption) {
      // Para áudio: transcrição substitui o texto
      effectiveUserText = mediaCaption;
    } else if (mediaInfo.type === "image" && mediaCaption) {
      // Para imagem: junta caption do usuário + descrição Gemini
      const userCaption = mediaInfo.caption ? `"${mediaInfo.caption}" ` : "";
      effectiveUserText = userCaption + `[Imagem enviada]`;
    } else if (mediaInfo.type === "document" && mediaCaption) {
      const userCaption = mediaInfo.title ? `"${mediaInfo.title}" ` : "";
      effectiveUserText = `[Documento: ${userCaption}]`;
    }

    // Se completamente vazio após processamento, ignora
    if (!effectiveUserText && !mediaCaption) {
      return NextResponse.json({ ok: true, ignored: "mensagem_vazia" });
    }

    const textToSave = effectiveUserText || "[mídia sem texto]";

    // 10. Buscar ou criar conversa
    let conversation = await prisma.conversation.findFirst({
      where: { source: "whatsapp", phone },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { source: "whatsapp", phone },
      });
    }

    // 11. Salvar mensagem do usuário com metadados de mídia e ID único do WhatsApp (para idempotência)
    await prisma.message.create({
      data: {
        id: messageId,
        conversationId: conversation.id,
        role: "user",
        content: textToSave,
        mediaType: detectedMediaType,
        mediaCaption: mediaCaption || null,
      },
    });

    // 12. Buscar histórico para contexto
    const historyLimit = config.historyLimit || 10;
    const dbMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: historyLimit,
    });

    const chatHistory = dbMessages.reverse().map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // 13. Injetar contexto de mídia no sistema
    let systemPromptWithMedia = config.systemPrompt;
    if (mediaCaption && mediaInfo.type && mediaInfo.type !== "audio") {
      const mediaLabel =
        mediaInfo.type === "image" ? "imagem" :
        mediaInfo.type === "document" ? "documento" : "mídia";
      systemPromptWithMedia +=
        `\n\n[CONTEXTO DE MÍDIA — ${mediaLabel.toUpperCase()} RECEBIDA]\n${mediaCaption}\n[FIM DO CONTEXTO]`;
    }

    // 14. Gerar resposta de texto com IA (com fallback resiliente para evitar travamento)
    let aiResult: { content: string; tokens: number } | null = null;
    let usedProvider = config.aiProvider || "openai";

    try {
      aiResult = await generateResponse(
        chatHistory,
        systemPromptWithMedia,
        config.temperature,
        config.maxTokens,
        {
          aiProvider: config.aiProvider,
          openaiApiKey: config.openaiApiKey,
          openaiModel: config.openaiModel,
          groqApiKey: config.groqApiKey,
          groqModel: config.groqModel,
          geminiApiKey: config.geminiApiKey,
          geminiModel: config.geminiModel,
        }
      );
    } catch (firstErr: any) {
      console.warn(`[Webhook] Falha no provedor principal (${config.aiProvider}):`, firstErr.message);

      // Tentar fallback inteligente para outros provedores se o principal falhar
      if (config.aiProvider === "gemini") {
        if (config.groqApiKey && config.groqApiKey.trim() !== "") {
          console.log("[Webhook] Tentando fallback resiliente para Groq...");
          try {
            aiResult = await generateResponse(
              chatHistory,
              systemPromptWithMedia,
              config.temperature,
              config.maxTokens,
              {
                aiProvider: "groq",
                groqApiKey: config.groqApiKey,
                groqModel: config.groqModel || "llama-3.3-70b-versatile",
              }
            );
            usedProvider = "groq";
            console.log("[Webhook] Fallback para Groq funcionou com sucesso!");
          } catch (groqErr: any) {
            console.error("[Webhook] Falha no fallback para Groq:", groqErr.message);
          }
        }

        if (!aiResult && config.openaiApiKey && config.openaiApiKey.trim() !== "") {
          console.log("[Webhook] Tentando fallback resiliente para OpenAI...");
          try {
            aiResult = await generateResponse(
              chatHistory,
              systemPromptWithMedia,
              config.temperature,
              config.maxTokens,
              {
                aiProvider: "openai",
                openaiApiKey: config.openaiApiKey,
                openaiModel: config.openaiModel || "gpt-4.1-mini",
              }
            );
            usedProvider = "openai";
            console.log("[Webhook] Fallback para OpenAI funcionou com sucesso!");
          } catch (openaiErr: any) {
            console.error("[Webhook] Falha no fallback para OpenAI:", openaiErr.message);
          }
        }
      } else if (config.aiProvider === "groq") {
        if (config.openaiApiKey && config.openaiApiKey.trim() !== "") {
          console.log("[Webhook] Tentando fallback resiliente para OpenAI...");
          try {
            aiResult = await generateResponse(
              chatHistory,
              systemPromptWithMedia,
              config.temperature,
              config.maxTokens,
              {
                aiProvider: "openai",
                openaiApiKey: config.openaiApiKey,
                openaiModel: config.openaiModel || "gpt-4.1-mini",
              }
            );
            usedProvider = "openai";
            console.log("[Webhook] Fallback para OpenAI funcionou com sucesso!");
          } catch (openaiErr: any) {
            console.error("[Webhook] Falha no fallback para OpenAI:", openaiErr.message);
          }
        }
      }

      // Se nenhum provedor funcionou ou não há chaves de fallback, usa resposta amigável padrão
      if (!aiResult) {
        console.warn("[Webhook] Todos os provedores de IA disponíveis falharam. Usando resposta amigável de fallback.");
        aiResult = {
          content: "Olá! Desculpe o transtorno, mas meu sistema de inteligência artificial está passando por uma oscilação temporária ou manutenção rápida. Por favor, tente enviar sua mensagem novamente em alguns instantes. Agradeço sua paciência! 🙏",
          tokens: 0
        };
      }
    }

    // 15. Salvar resposta da IA
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "model",
        content: aiResult.content,
        tokens: aiResult.tokens,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // 16. Enviar resposta via Evolution API (texto ou áudio dependendo do modo)
    if (config.evolutionUrl && config.evolutionApiKey && config.instanceId) {
      const audioMode = (config as any).audioResponseMode || "on_audio";
      const shouldSendAudio =
        audioMode === "always" ||
        (audioMode === "on_audio" && isAudioMessage);

      let audioSent = false;

      // Se Cartesia estiver selecionado, não exige obrigatoriamente a geminiApiKey para TTS
      const hasTtsCredentials = 
        (config.ttsProvider === "cartesia" && config.cartesiaApiKey) ||
        (config.ttsProvider !== "cartesia" && config.geminiApiKey);

      if (shouldSendAudio && hasTtsCredentials) {
        try {
          // Sinaliza "gravando áudio..." no status de presença do WhatsApp
          await sendWhatsAppPresence(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            remoteJid,
            "recording"
          );

          const audioBase64 = await generateSpeech(
            aiResult.content,
            config
          );

          if (audioBase64) {
            await sendWhatsAppAudio(
              config.evolutionUrl,
              config.evolutionApiKey,
              config.instanceId,
              remoteJid,
              audioBase64
            );
            audioSent = true;
            console.log(`[Webhook] Resposta enviada como nota de voz para +${phone}`);

            // Marcar mensagem do cliente como lida após o envio do áudio
            await markWhatsAppMessageAsRead(
              config.evolutionUrl,
              config.evolutionApiKey,
              config.instanceId,
              remoteJid,
              messageId
            );
          }
        } catch (ttsErr: any) {
          console.warn("[Webhook] Falha no TTS, fazendo fallback para texto:", ttsErr.message);
        }
      }

      // Fallback: enviar texto se áudio não foi enviado
      if (!audioSent) {
        // Auxiliar: Quebra de texto inteligente por parágrafos para simular digitação e evitar mensagens gigantes
        const splitResponseIntoParagraphs = (text: string): string[] => {
          if (!text) return [];
          const paragraphs = text
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(Boolean);

          if (paragraphs.length <= 1) {
            const single = text.trim();
            if (single.length > 500) {
              return single
                .split(/\n+/)
                .map(p => p.trim())
                .filter(Boolean);
            }
          }
          return paragraphs;
        };

        const textChunks = splitResponseIntoParagraphs(aiResult.content);
        console.log(`[Webhook] Enviando ${textChunks.length} mensagens parceladas com simulação de digitação.`);
        
        for (let i = 0; i < textChunks.length; i++) {
          // 1. Sinaliza digitação no WhatsApp
          await sendWhatsAppPresence(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            remoteJid,
            "composing"
          );

          // 2. Delay proporcional de simulação de digitação (mínimo 1.5s, máximo 4.5s)
          const typingMs = Math.min(4500, Math.max(1500, textChunks[i].length * 20));
          await new Promise(resolve => setTimeout(resolve, typingMs));

          // 3. Envia o fragmento de texto
          await sendWhatsAppMessage(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            remoteJid,
            textChunks[i]
          );

          // 4. Se for a primeira mensagem enviada do lote, marcar a mensagem do cliente como lida
          if (i === 0) {
            await markWhatsAppMessageAsRead(
              config.evolutionUrl,
              config.evolutionApiKey,
              config.instanceId,
              remoteJid,
              messageId
            );
          }

          // Pequeno silêncio de transição entre envios
          if (i < textChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
      }
    } else {
      console.warn("[Webhook] Evolution API não configurada. Resposta de IA não entregue.");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Error] Falha fatal no webhook:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (messageIdToClean) {
      activeMessageIds.delete(messageIdToClean);
    }
  }
}
