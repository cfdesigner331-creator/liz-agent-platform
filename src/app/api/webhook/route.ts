import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/lib/openai";
import {
  sendWhatsAppMessage,
  sendWhatsAppPresence,
  sendWhatsAppAudio,
  markWhatsAppMessageAsRead
} from "@/lib/evolution";
import {
  detectMediaType,
  downloadMediaFromEvolution,
  transcribeAudio,
  analyzeImage,
  analyzeDocument,
  generateSpeech,
} from "@/lib/media";

import { checkAndAutoCompilePrompt } from "@/lib/learning";

// Cache estático de mensagens em processamento concorrente para desduplicação
const activeMessageIds = new Set<string>();

export async function POST(req: Request) {
  let messageIdToClean: string | null = null;
  try {
    // 1. Carregar configurações do banco antes de processar o webhook
    const config = await prisma.agentConfig.findFirst();
    if (!config || config.enabled === false) {
      return NextResponse.json({ ok: true, ignored: "agente_desativado" });
    }

    // Autocompilação do prompt a cada 7 dias de forma silenciosa e segura
    try {
      await checkAndAutoCompilePrompt();
    } catch (e) {
      console.warn("[Webhook] Falha na autocompilação automática do prompt:", e);
    }

    const provider = (config as any).whatsappProvider || "evolution";
    const body = await req.json();
    const { event } = body;

    let phone = "";
    let messageId = "";
    let textToSave = "";
    let detectedMediaType = "chat";
    let isAudioMessage = false;
    let mediaCaption = "";
    let remoteJid = ""; // Apenas para Evolution API

    // ==========================================
    // PARSER DUPLO: WISETALK CRM VS EVOLUTION API
    // ==========================================
    if (provider === "wisetalk") {
      // 2a. Parser WiseTalk CRM
      if (event !== "NewMessage") {
        return NextResponse.json({ ok: true, ignored: "evento_nao_suportado_wisetalk" });
      }

      const message = body.message;
      if (!message || !message.id || !message.ticketId) {
        return NextResponse.json({ ok: true, ignored: "payload_incompleto_wisetalk" });
      }

      messageId = message.id;

      // Extração dinâmica e resiliente do telefone do cliente
      let extractedPhone = "";
      if (body.contact?.number) {
        extractedPhone = body.contact.number;
      } else if (body.ticket?.contact?.number) {
        extractedPhone = body.ticket.contact.number;
      } else if (message.contact?.number) {
        extractedPhone = message.contact.number;
      }

      // Se não encontrou ou se é muito curto (ID de 6 dígitos do CRM), tenta ler dos metadados brutos (raw.Info) do WhatsApp
      if (!extractedPhone || extractedPhone.replace(/[^0-9]/g, "").length < 8) {
        const rawInfo = message.raw?.Info;
        if (rawInfo) {
          const rawJid = rawInfo.Chat || rawInfo.SenderAlt || rawInfo.Sender || "";
          if (rawJid && rawJid.includes("@")) {
            extractedPhone = rawJid.split("@")[0];
          }
        }
      }

      // Fallback final para contactId
      if (!extractedPhone) {
        if (body.contactId) {
          extractedPhone = String(body.contactId);
        } else if (message.contactId) {
          extractedPhone = String(message.contactId);
        }
      }

      phone = extractedPhone.replace(/[^0-9]/g, "");
      if (!phone) {
        return NextResponse.json({ ok: true, ignored: "telefone_nao_identificado_wisetalk" });
      }

      textToSave = (message.body || "").trim();
      detectedMediaType = message.mediaType || "chat";
      isAudioMessage = detectedMediaType === "audio";

      // Tratar mensagens enviadas pelo atendente humano ou pela IA (fromMe === true)
      if (message.fromMe === true) {
        const existingMsg = await prisma.message.findUnique({
          where: { id: messageId }
        });
        if (existingMsg) {
          return NextResponse.json({ ok: true, ignored: "mensagem_propria_ja_salva" });
        }

        let conversation = await prisma.conversation.findFirst({
          where: { source: "whatsapp", phone },
        });
        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: { source: "whatsapp", phone },
          });
        }

        let agentMessageText = textToSave;
        if (!agentMessageText && detectedMediaType && detectedMediaType !== "chat") {
          agentMessageText = `[Mídia enviada pelo atendente: ${detectedMediaType}]`;
        }

        if (agentMessageText.trim()) {
          await prisma.message.create({
            data: {
              id: messageId,
              conversationId: conversation.id,
              role: "model",
              content: agentMessageText.trim(),
            },
          });
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });
        }
        return NextResponse.json({ ok: true, saved: "mensagem_atendente_wisetalk" });
      }

      // Download de mídia direto por link HTTP no WiseTalk
      if (message.mediaUrl && message.mediaUrl.trim() !== "" && (config.geminiApiKey || config.openaiApiKey || config.groqApiKey)) {
        try {
          console.log(`[Webhook WiseTalk] Baixando mídia (${detectedMediaType}) via link: ${message.mediaUrl}`);
          const mediaRes = await fetch(message.mediaUrl);
          if (mediaRes.ok) {
            const arrayBuffer = await mediaRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString("base64");
            const mimetype = mediaRes.headers.get("content-type") || "";

            if (detectedMediaType === "audio") {
              mediaCaption = await transcribeAudio(base64, mimetype, config);
              console.log(`[Webhook WiseTalk] Transcrição: ${mediaCaption.substring(0, 80)}...`);
            } else if (detectedMediaType === "image") {
              mediaCaption = await analyzeImage(base64, mimetype, message.caption || "", config);
            } else if (detectedMediaType === "document") {
              mediaCaption = await analyzeDocument(base64, mimetype, message.originalName || "", config);
            }
          }
        } catch (mediaErr: any) {
          console.error("[Webhook WiseTalk] Falha ao processar mídia externa:", mediaErr.message);
        }
      }

      // Formatar texto final do usuário com base no processamento de mídia
      if (detectedMediaType === "audio" && mediaCaption) {
        textToSave = mediaCaption;
      } else if (detectedMediaType === "image" && mediaCaption) {
        const userCaption = message.caption ? `"${message.caption}" ` : "";
        textToSave = userCaption + `[Imagem enviada]`;
      } else if (detectedMediaType === "document" && mediaCaption) {
        const userCaption = message.originalName ? `"${message.originalName}" ` : "";
        textToSave = `[Documento: ${userCaption}]`;
      }

    } else {
      // 2b. Parser Evolution API
      if (event !== "messages.upsert") {
        return NextResponse.json({ ok: true, ignored: "evento_nao_suportado_evolution" });
      }

      const data = body.data;
      if (!data || !data.key || !data.key.remoteJid || !data.key.id) {
        return NextResponse.json({ ok: true, ignored: "payload_incompleto_evolution" });
      }

      const { remoteJid: evoJid, fromMe, id: evoMsgId } = data.key;
      messageId = evoMsgId;
      remoteJid = evoJid;

      // Tratar mensagens enviadas por nós mesmos / atendentes humanos diretamente na Evolution API
      if (fromMe === true) {
        const existingMsg = await prisma.message.findUnique({
          where: { id: messageId }
        });
        if (existingMsg) {
          return NextResponse.json({ ok: true, ignored: "mensagem_propria_ja_salva" });
        }

        const phoneFromEvo = remoteJid.replace("@s.whatsapp.net", "");
        let conversation = await prisma.conversation.findFirst({
          where: { source: "whatsapp", phone: phoneFromEvo },
        });
        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: { source: "whatsapp", phone: phoneFromEvo },
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
              role: "model",
              content: agentMessageText.trim(),
            },
          });
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });
        }
        return NextResponse.json({ ok: true, saved: "mensagem_atendente_humano" });
      }

      // Ignorar grupos no padrão Evolution
      if (remoteJid.includes("@g.us")) {
        return NextResponse.json({ ok: true, ignored: "mensagem_grupo" });
      }

      phone = remoteJid.replace("@s.whatsapp.net", "");
      const messageContent = data.message;

      // Detectar mídia
      const mediaInfo = detectMediaType(messageContent || {});
      detectedMediaType = mediaInfo.type || "chat";
      isAudioMessage = detectedMediaType === "audio";

      let userMessageText = "";
      if (messageContent) {
        if (messageContent.conversation) {
          userMessageText = messageContent.conversation;
        } else if (messageContent.extendedTextMessage?.text) {
          userMessageText = messageContent.extendedTextMessage.text;
        }
      }

      // Download de mídia do Evolution usando a Chave de API
      if (mediaInfo.type && (config.geminiApiKey || config.openaiApiKey || config.groqApiKey)) {
        try {
          console.log(`[Webhook Evolution] Mídia detectada: ${mediaInfo.type}`);
          const mediaData = await downloadMediaFromEvolution(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            data.key
          );

          if (mediaData) {
            if (mediaInfo.type === "audio") {
              mediaCaption = await transcribeAudio(mediaData.base64, mediaData.mimetype, config);
              console.log(`[Webhook Evolution] Transcrição: ${mediaCaption.substring(0, 80)}...`);
            } else if (mediaInfo.type === "image") {
              mediaCaption = await analyzeImage(mediaData.base64, mediaData.mimetype, mediaInfo.caption, config);
            } else if (mediaInfo.type === "document") {
              mediaCaption = await analyzeDocument(mediaData.base64, mediaData.mimetype, mediaInfo.title, config);
            }
          }
        } catch (mediaErr: any) {
          console.error("[Webhook Evolution] Falha ao processar mídia interna:", mediaErr.message);
        }
      }

      // Formatar texto final do usuário com base no processamento de mídia
      textToSave = userMessageText.trim();
      if (mediaInfo.type === "audio" && mediaCaption) {
        textToSave = mediaCaption;
      } else if (mediaInfo.type === "image" && mediaCaption) {
        const userCaption = mediaInfo.caption ? `"${mediaInfo.caption}" ` : "";
        textToSave = userCaption + `[Imagem enviada]`;
      } else if (mediaInfo.type === "document" && mediaCaption) {
        const userCaption = mediaInfo.title ? `"${mediaInfo.title}" ` : "";
        textToSave = `[Documento: ${userCaption}]`;
      }
    }

    // ==========================================
    // PROCESSAMENTO COMUM DA MENSAGEM (IA & DB)
    // ==========================================

    // Se completamente vazio após processamento, ignora
    if (!textToSave && !mediaCaption) {
      return NextResponse.json({ ok: true, ignored: "mensagem_sem_conteudo" });
    }

    // Evitar duplicados (Desduplicação e Idempotência)
    if (activeMessageIds.has(messageId)) {
      return NextResponse.json({ ok: true, ignored: "duplicado_in_flight", messageId });
    }

    const existingMsg = await prisma.message.findUnique({
      where: { id: messageId }
    });
    if (existingMsg) {
      return NextResponse.json({ ok: true, ignored: "duplicado_db", messageId });
    }

    // Registrar no cache concorrente
    activeMessageIds.add(messageId);
    messageIdToClean = messageId;

    if (activeMessageIds.size > 1000) {
      activeMessageIds.clear();
    }

    // Verificar allowedPhones
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

    // Iniciar simulação de digitação imediata no provedor compatível (Evolution)
    if (provider === "evolution" && config.evolutionUrl && config.evolutionApiKey && config.instanceId) {
      await sendWhatsAppPresence(
        provider,
        config.evolutionUrl,
        config.evolutionApiKey,
        config.instanceId,
        remoteJid,
        "composing"
      );
    }

    // Buscar ou criar conversa
    let conversation = await prisma.conversation.findFirst({
      where: { source: "whatsapp", phone },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { source: "whatsapp", phone },
      });
    }

     // Salvar mensagem do usuário
     await prisma.message.create({
       data: {
         id: messageId,
         conversationId: conversation.id,
         role: "user",
         content: textToSave || "[mídia sem texto]",
         mediaType: ["audio", "image", "document"].includes(detectedMediaType) ? detectedMediaType : null,
         mediaCaption: mediaCaption || null,
       },
     });

    // Verificar se o Modo Treinamento (Modo Observação) está ativo
    if (config.observationMode === true) {
      console.log(`[Webhook Dual] Agente em Modo Observação. Mensagem salva silenciosamente no banco.`);
      return NextResponse.json({ ok: true, ignored: "modo_observacao_ativo" });
    }

    // Verificar se a conversa já está encerrada (triagem concluída)
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
      console.log(`[Webhook Dual] Triagem já concluída para +${phone}. IA silenciosa.`);
      return NextResponse.json({ ok: true, ignored: "conversa_encerrada_triagem_concluida" });
    }

    // Verificar Horário de Atendimento (Schedule)
    if (config.scheduleEnabled) {
      const timezone = config.scheduleTimezone || "America/Sao_Paulo";
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
        console.error("[Webhook Dual] Erro ao computar fuso horário:", err);
        nowInTz = new Date();
      }

      const currentDay = nowInTz.getDay();
      const currentHours = nowInTz.getHours();
      const currentMinutes = nowInTz.getMinutes();
      const currentTimeMinutes = currentHours * 60 + currentMinutes;

      const mode = config.scheduleMode || "normal";

      if (mode === "plantao") {
        const isWeekday = currentDay >= 1 && currentDay <= 5;
        const isTimeAuthorized = currentTimeMinutes >= 12 * 60;
        if (!isWeekday || !isTimeAuthorized) {
          console.log(`[Webhook Dual] Silenciador de Plantão: Fora do período autorizado.`);
          return NextResponse.json({ ok: true, ignored: "plantao_inteligente_fora_do_periodo_autorizado" });
        }
      } else {
        let allowedDays: number[] = [1, 2, 3, 4, 5];
        try {
          allowedDays = JSON.parse(config.scheduleDays || "[1,2,3,4,5]");
        } catch (e) {
          console.error("[Webhook Dual] Erro ao parsear scheduleDays:", e);
        }

        let startMinutes = 8 * 60;
        const startParts = (config.scheduleStartTime || "08:00").split(":");
        if (startParts.length === 2) {
          startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        }

        let endMinutes = 18 * 60;
        const endParts = (config.scheduleEndTime || "18:00").split(":");
        if (endParts.length === 2) {
          endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        }

        const isDayAllowed = allowedDays.includes(currentDay);
        const isTimeAllowed = currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;

        if (!isDayAllowed || !isTimeAllowed) {
          console.log(`[Webhook Dual] Fora do expediente comercial. Enviando resposta de ausência.`);
          await sendWhatsAppMessage(
            provider,
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            provider === "evolution" ? remoteJid : phone,
            config.scheduleOffMessage || "Olá! No momento estou fora do horário de atendimento. Em breve retornarei! 😊"
          );
          return NextResponse.json({ ok: true, ignored: "fora_de_horario" });
        }
      }
    }

    // Buscar histórico para contexto da IA
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

    // Injetar contexto de Data/Hora
    const timezone = config.scheduleTimezone || "America/Sao_Paulo";
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
    } catch (err) {}

    const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const diaNome = diasSemana[nowInTz.getDay()];
    const dataFormatada = nowInTz.toLocaleDateString("pt-BR");
    const horaFormatada = nowInTz.toTimeString().split(" ")[0].substring(0, 5);

    let systemPromptWithMedia = `[INFORMAÇÃO TEMPORAL - CRÍTICO]
- Fuso Horário Configurado: ${timezone}
- Data de Hoje: ${dataFormatada} (${diaNome})
- Hora Atual: ${horaFormatada}
* IMPORTANTE: Use a Hora Atual para determinar a saudação adequada.
  - Se a hora for de 06:00 até 11:59, diga "Bom dia".
  - Se a hora for de 12:00 até 17:59, diga "Boa tarde".
  - Se a hora for de 18:00 até 05:59, diga "Boa noite".
[FIM DA INFORMAÇÃO TEMPORAL]\n\n` + config.systemPrompt;

    if (mediaCaption && detectedMediaType && detectedMediaType !== "audio") {
      const mediaLabel = detectedMediaType === "image" ? "imagem" : "documento";
      systemPromptWithMedia += `\n\n[CONTEXTO DE MÍDIA — ${mediaLabel.toUpperCase()} RECEBIDA]\n${mediaCaption}\n[FIM DO CONTEXTO]`;
    }

    // Gerar resposta da IA
    let aiResult: { content: string; tokens: number } | null = null;
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
      console.warn(`[Webhook Dual] Falha no provedor principal (${config.aiProvider}):`, firstErr.message);

      // Fallback
      if (config.aiProvider === "gemini") {
        if (config.groqApiKey && config.groqApiKey.trim() !== "") {
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
          } catch (e) {}
        }
        if (!aiResult && config.openaiApiKey && config.openaiApiKey.trim() !== "") {
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
          } catch (e) {}
        }
      } else if (config.aiProvider === "groq") {
        if (config.openaiApiKey && config.openaiApiKey.trim() !== "") {
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
          } catch (e) {}
        }
      }

      if (!aiResult) {
        aiResult = {
          content: "Olá! Desculpe o transtorno, mas meu sistema está passando por uma oscilação rápida. Por favor, tente novamente em alguns instantes. 🙏",
          tokens: 0
        };
      }
    }

    // Salvar resposta da IA no banco
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

    // Enviar resposta utilizando o provedor parametrizado
    if (config.evolutionUrl && config.evolutionApiKey && config.instanceId) {
      const audioMode = (config as any).audioResponseMode || "on_audio";
      const shouldSendAudio =
        audioMode === "always" ||
        (audioMode === "on_audio" && isAudioMessage);

      let audioSent = false;
      const hasTtsCredentials = 
        (config.ttsProvider === "cartesia" && config.cartesiaApiKey) ||
        (config.ttsProvider !== "cartesia" && config.geminiApiKey);

      // NOTA DE VOZ (Suportado apenas para Evolution API)
      if (provider === "evolution" && shouldSendAudio && hasTtsCredentials) {
        try {
          await sendWhatsAppPresence(
            provider,
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            remoteJid,
            "recording"
          );

          const audioBase64 = await generateSpeech(aiResult.content, config);

          if (audioBase64) {
            await sendWhatsAppAudio(
              provider,
              config.evolutionUrl,
              config.evolutionApiKey,
              config.instanceId,
              remoteJid,
              audioBase64
            );
            audioSent = true;

            await markWhatsAppMessageAsRead(
              provider,
              config.evolutionUrl,
              config.evolutionApiKey,
              config.instanceId,
              remoteJid,
              messageId
            );
          }
        } catch (ttsErr: any) {
          console.warn("[Webhook Dual] Falha no TTS de áudio, fazendo fallback para texto:", ttsErr.message);
        }
      }

      // Enviar via Texto (Evolution API ou WiseTalk CRM)
      if (!audioSent) {
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
        console.log(`[Webhook Dual] Enviando ${textChunks.length} mensagens parceladas.`);
        
        for (let i = 0; i < textChunks.length; i++) {
          if (provider === "evolution") {
            await sendWhatsAppPresence(
              provider,
              config.evolutionUrl,
              config.evolutionApiKey,
              config.instanceId,
              remoteJid,
              "composing"
            );
          }

          const typingMs = Math.min(4000, Math.max(1500, textChunks[i].length * 20));
          await new Promise(resolve => setTimeout(resolve, typingMs));

          let chunkToSend = textChunks[i];
          if (i === 0 && config.textTitleEnabled && config.textTitle) {
            chunkToSend = `*${config.textTitle.trim()}*\n\n${chunkToSend}`;
          }

          await sendWhatsAppMessage(
            provider,
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            provider === "evolution" ? remoteJid : phone,
            chunkToSend
          );

          if (i === 0 && provider === "evolution") {
            await markWhatsAppMessageAsRead(
              provider,
              config.evolutionUrl,
              config.evolutionApiKey,
              config.instanceId,
              remoteJid,
              messageId
            );
          }

          if (i < textChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
      }
    } else {
      console.warn("[Webhook Dual] Configurações de API incompletas. Mensagem da IA não enviada.");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Dual Error] Falha crítica:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (messageIdToClean) {
      activeMessageIds.delete(messageIdToClean);
    }
  }
}
