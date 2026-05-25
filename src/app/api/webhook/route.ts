import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/lib/openai";
import { sendWhatsAppMessage } from "@/lib/evolution";
import {
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
    const { event } = body;

    // 1. Ignorar se o evento for diferente de NewMessage do WiseTalk
    if (event !== "NewMessage") {
      return NextResponse.json({ ok: true, ignored: "evento_nao_suportado_pela_ia" });
    }

    const message = body.message;
    if (!message || !message.id || !message.ticketId) {
      return NextResponse.json({ ok: true, ignored: "payload_incompleto" });
    }

    const messageId = message.id;

    // 2. Ignorar mensagens enviadas por nós mesmos (evitar loops de IA)
    if (message.fromMe === true) {
      return NextResponse.json({ ok: true, ignored: "mensagem_propria_ignorada" });
    }

    // 3. Extrair telefone do cliente dinamicamente do payload
    let phone = "";
    if (body.contact?.number) {
      phone = body.contact.number;
    } else if (body.ticket?.contact?.number) {
      phone = body.ticket.contact.number;
    } else if (message.contact?.number) {
      phone = message.contact.number;
    } else if (body.contactId) {
      phone = String(body.contactId);
    } else if (message.contactId) {
      phone = String(message.contactId);
    }

    phone = phone.replace(/[^0-9]/g, "");
    if (!phone) {
      return NextResponse.json({ ok: true, ignored: "telefone_nao_identificado" });
    }

    // 3.1. Evitar duplicados (Desduplicação e Idempotência)
    if (activeMessageIds.has(messageId)) {
      console.log(`[Webhook WiseTalk] Ignorando mensagem concorrente (in-flight): ${messageId}`);
      return NextResponse.json({ ok: true, ignored: "duplicado_in_flight", messageId });
    }

    const existingMsg = await prisma.message.findUnique({
      where: { id: messageId }
    });
    if (existingMsg) {
      console.log(`[Webhook WiseTalk] Ignorando mensagem duplicada (no banco): ${messageId}`);
      return NextResponse.json({ ok: true, ignored: "duplicado_db", messageId });
    }

    // Registrar no cache concorrente
    activeMessageIds.add(messageId);
    messageIdToClean = messageId;

    if (activeMessageIds.size > 1000) {
      activeMessageIds.clear();
    }

    const textToSave = (message.body || "").trim();

    // 4. Carregar configurações do WiseTalk
    const config = await prisma.agentConfig.findFirst();
    if (!config || config.enabled === false) {
      return NextResponse.json({ ok: true, ignored: "agente_desativado" });
    }

    // 5. Verificar allowedPhones se configurado
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

    // 6. Se houver mídia — baixar pela URL e processar com a IA
    let mediaCaption = "";
    let detectedMediaType = message.mediaType || "chat";
    let isAudioMessage = detectedMediaType === "audio";

    if (message.mediaUrl && message.mediaUrl.trim() !== "" && (config.geminiApiKey || config.openaiApiKey || config.groqApiKey)) {
      try {
        console.log(`[Webhook WiseTalk] Baixando mídia (${detectedMediaType}): ${message.mediaUrl}`);
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
        console.error("[Webhook WiseTalk] Falha ao processar mídia:", mediaErr.message);
      }
    }

    // 7. Montar texto final do usuário para a IA
    let effectiveUserText = textToSave;
    if (detectedMediaType === "audio" && mediaCaption) {
      effectiveUserText = mediaCaption;
    } else if (detectedMediaType === "image" && mediaCaption) {
      const userCaption = message.caption ? `"${message.caption}" ` : "";
      effectiveUserText = userCaption + `[Imagem enviada]`;
    } else if (detectedMediaType === "document" && mediaCaption) {
      const userCaption = message.originalName ? `"${message.originalName}" ` : "";
      effectiveUserText = `[Documento: ${userCaption}]`;
    }

    if (!effectiveUserText && !mediaCaption) {
      return NextResponse.json({ ok: true, ignored: "mensagem_sem_conteudo" });
    }

    // 8. Criar ou buscar conversa
    let conversation = await prisma.conversation.findFirst({
      where: { source: "whatsapp", phone },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { source: "whatsapp", phone },
      });
    }

    // 9. Salvar mensagem do usuário
    await prisma.message.create({
      data: {
        id: messageId,
        conversationId: conversation.id,
        role: "user",
        content: effectiveUserText || "[mídia sem texto]",
        mediaType: detectedMediaType,
        mediaCaption: mediaCaption || null,
      },
    });

    // 10. Verificar se o Modo Treinamento (Modo Observação) está ativo
    if (config.observationMode === true) {
      console.log(`[Webhook WiseTalk] Modo Treinamento ativo. Mensagem de +${phone} salva silenciosamente.`);
      return NextResponse.json({ ok: true, ignored: "modo_observacao_ativo" });
    }

    // 11. Verificar se a conversa possui triagem concluída
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
      console.log(`[Webhook WiseTalk] Triagem já concluída para +${phone}. IA silenciosa.`);
      return NextResponse.json({ ok: true, ignored: "conversa_encerrada_triagem_concluida" });
    }

    // 12. Horário de Atendimento (Schedule)
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
        console.error("[Webhook WiseTalk] Erro no fuso horário, usando hora local:", err);
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
          console.log(`[Webhook WiseTalk] Silenciador de Plantão ativo para +${phone}.`);
          return NextResponse.json({ ok: true, ignored: "plantao_inteligente_fora_do_periodo_autorizado" });
        }
      } else {
        let allowedDays: number[] = [1, 2, 3, 4, 5];
        try {
          allowedDays = JSON.parse(config.scheduleDays || "[1,2,3,4,5]");
        } catch (e) {
          console.error("[Webhook WiseTalk] Erro ao parsear scheduleDays:", e);
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
          console.log(`[Webhook WiseTalk] Fora do expediente comercial. Enviando resposta de ausência.`);
          await sendWhatsAppMessage(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.instanceId,
            phone,
            config.scheduleOffMessage || "Olá! No momento estou fora do horário de atendimento. Em breve retornarei! 😊"
          );
          return NextResponse.json({ ok: true, ignored: "fora_de_horario" });
        }
      }
    }

    // 13. Buscar histórico para contexto da IA
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

    // Contexto de tempo da IA
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
    } catch (err) {
      console.error("[Webhook WiseTalk] Erro no fuso horário para a IA:", err);
    }

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

    // 14. Gerar resposta com IA
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
      console.warn(`[Webhook WiseTalk] Falha no provedor principal (${config.aiProvider}):`, firstErr.message);

      // Fallback Groq/OpenAI
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
          content: "Olá! Desculpe o transtorno, mas meu sistema de inteligência artificial está passando por uma oscilação temporária. Por favor, tente enviar sua mensagem novamente em alguns instantes. 🙏",
          tokens: 0
        };
      }
    }

    // 15. Salvar resposta da IA no banco
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

    // 16. Enviar resposta dividida por parágrafos para o WiseTalk
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
    console.log(`[Webhook WiseTalk] Enviando ${textChunks.length} mensagens parceladas.`);

    for (let i = 0; i < textChunks.length; i++) {
      // Simulação de digitação (delay proporcional de 1.5s a 4s)
      const typingMs = Math.min(4000, Math.max(1500, textChunks[i].length * 20));
      await new Promise(resolve => setTimeout(resolve, typingMs));

      let chunkToSend = textChunks[i];
      if (i === 0 && config.textTitleEnabled && config.textTitle) {
        chunkToSend = `*${config.textTitle.trim()}*\n\n${chunkToSend}`;
      }

      await sendWhatsAppMessage(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.instanceId,
        phone,
        chunkToSend
      );

      if (i < textChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook WiseTalk Error] Falha no webhook:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (messageIdToClean) {
      activeMessageIds.delete(messageIdToClean);
    }
  }
}
