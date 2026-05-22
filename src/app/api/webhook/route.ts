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
  transcribeAudio,
  analyzeImage,
  analyzeDocument,
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

    // 2. Tratar mensagens enviadas por nós mesmos (ou atendentes humanos)
    if (fromMe === true) {
      // Se já existe no banco, ignora (foi enviado pela própria IA e salvo anteriormente)
      const existingMsg = await prisma.message.findUnique({
        where: { id: messageId }
      });
      if (existingMsg) {
        return NextResponse.json({ ok: true, ignored: "mensagem_propria_ja_salva" });
      }

      // Caso contrário, a mensagem foi enviada por um atendente humano diretamente no WhatsApp!
      const phone = remoteJid.replace("@s.whatsapp.net", "");
      let conversation = await prisma.conversation.findFirst({
        where: { source: "whatsapp", phone },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { source: "whatsapp", phone },
        });
      }

      const messageContent = data.message;
      let agentMessageText = "";
      if (messageContent) {
        if (messageContent.conversation) {
          agentMessageText = messageContent.conversation;
        } else if (messageContent.extendedTextMessage?.text) {
          agentMessageText = messageContent.extendedTextMessage.text;
        } else if (messageContent.imageMessage) {
          agentMessageText = messageContent.imageMessage.caption || "[Imagem enviada pelo atendente]";
        } else if (messageContent.videoMessage) {
          agentMessageText = messageContent.videoMessage.caption || "[Vídeo enviado pelo atendente]";
        } else if (messageContent.audioMessage) {
          agentMessageText = "[Áudio enviado pelo atendente]";
        } else if (messageContent.documentMessage) {
          agentMessageText = messageContent.documentMessage.title ? `[Documento: ${messageContent.documentMessage.title}]` : "[Documento enviado pelo atendente]";
        } else {
          // Captura genérica para outros tipos de mídia/mensagem enviados pelo atendente
          const keys = Object.keys(messageContent);
          const typeName = keys.length > 0 ? keys[0] : "";
          if (typeName) {
            agentMessageText = `[Mensagem tipo ${typeName} enviada pelo atendente]`;
          }
        }
      }

      if (agentMessageText.trim()) {
        await prisma.message.create({
          data: {
            id: messageId,
            conversationId: conversation.id,
            role: "model", // Atendente humano usa papel de model para o histórico do chat da IA
            content: agentMessageText.trim(),
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        console.log(`[Webhook] Mensagem do atendente humano salva no histórico para +${phone}: ${agentMessageText.trim().substring(0, 50)}...`);
      }

      return NextResponse.json({ ok: true, saved: "mensagem_atendente_humano" });
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

    if (mediaInfo.type && (config.geminiApiKey || config.openaiApiKey || config.groqApiKey)) {
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
          mediaCaption = await transcribeAudio(
            mediaData.base64,
            mediaData.mimetype,
            config
          );
          console.log(`[Webhook] Transcrição: ${mediaCaption.substring(0, 80)}...`);
        } else if (mediaInfo.type === "image") {
          mediaCaption = await analyzeImage(
            mediaData.base64,
            mediaData.mimetype,
            mediaInfo.caption,
            config
          );
        } else if (mediaInfo.type === "document") {
          mediaCaption = await analyzeDocument(
            mediaData.base64,
            mediaData.mimetype,
            mediaInfo.title,
            config
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

    // 11.0. Verificar se o Modo Treinamento (Modo Observação) está ativo
    if ((config as any).observationMode === true) {
      console.log(`[Webhook] Agente em Modo Observação (Modo Treinamento). Mensagem de +${phone} salva silenciosamente no banco.`);
      return NextResponse.json({ ok: true, ignored: "modo_observacao_ativo" });
    }

    // 11.1. Verificar se a conversa já está encerrada (triagem concluída)
    // Se existir alguma mensagem anterior da IA contendo o resumo da solicitação, ignoramos silenciosamente
    const summaryMessage = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        role: "model",
        OR: [
          { content: { contains: "Resumo da Solicitação" } },
          { content: { contains: "resumo da solicitação" } },
          { content: { contains: "resumo da solicitacao" } },
          { content: { contains: "📋 Resumo" } },
          { content: { contains: "📋 resumo" } }
        ]
      }
    });

    if (summaryMessage) {
      console.log(`[Webhook] Conversa com +${phone} já possui triagem finalizada. Nova mensagem salva no banco silenciosamente (sem resposta).`);
      return NextResponse.json({ ok: true, ignored: "conversa_encerrada_triagem_concluida" });
    }

    // 11.2. Verificar Horário de Atendimento (Schedule)
    if (config.scheduleEnabled) {
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
        // Modo Plantão Inteligente: A Lis só pode responder mensagens de segunda a sexta, a partir das 12:00
        const isWeekday = currentDay >= 1 && currentDay <= 5;
        const isTimeAuthorized = currentTimeMinutes >= 12 * 60; // 12h em diante

        if (!isWeekday || !isTimeAuthorized) {
          console.log(`[Webhook] Silenciador Plantão Inteligente: Fora do período autorizado (segunda a sexta a partir das 12h). Dia: ${currentDay}, Hora: ${currentHours}:${currentMinutes}. Mensagem salva no histórico, IA silenciosa.`);
          return NextResponse.json({ ok: true, ignored: "plantao_inteligente_fora_do_periodo_autorizado" });
        }
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
          console.log(`[Webhook] Fora do expediente comercial. Enviando mensagem de ausência e salvando histórico. Dia: ${currentDay}, Hora: ${currentHours}:${currentMinutes}`);
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

    // 13. Injetar contexto de Data/Hora e Fuso Horário para a IA responder saudações corretas
    const timezone = (config as any).scheduleTimezone || "America/Sao_Paulo";
    let nowInTz = new Date();
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
      console.error("[Webhook] Erro ao computar timezone para a IA:", err);
    }

    const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const diaNome = diasSemana[nowInTz.getDay()];
    const dataFormatada = nowInTz.toLocaleDateString("pt-BR");
    const horaFormatada = nowInTz.toTimeString().split(" ")[0].substring(0, 5); // HH:MM

    let systemPromptWithMedia = `[INFORMAÇÃO TEMPORAL - CRÍTICO]
- Fuso Horário Configurado: ${timezone}
- Data de Hoje: ${dataFormatada} (${diaNome})
- Hora Atual: ${horaFormatada}
* IMPORTANTE: Use a Hora Atual para determinar a saudação adequada.
  - Se a hora for de 06:00 até 11:59, diga "Bom dia".
  - Se a hora for de 12:00 até 17:59, diga "Boa tarde".
  - Se a hora for de 18:00 até 05:59, diga "Boa noite".
[FIM DA INFORMAÇÃO TEMPORAL]\n\n` + config.systemPrompt;

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

          // 3. Envia o fragmento de texto (com opcional de título em negrito no primeiro fragmento)
          let chunkToSend = textChunks[i];
          if (i === 0 && (config as any).textTitleEnabled && (config as any).textTitle) {
            chunkToSend = `*${(config as any).textTitle.trim()}*\n\n${chunkToSend}`;
          }

          await sendWhatsAppMessage(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            remoteJid,
            chunkToSend
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
