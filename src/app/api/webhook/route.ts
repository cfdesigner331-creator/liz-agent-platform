import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/lib/openai";
import { sendWhatsAppMessage, sendWhatsAppAudio } from "@/lib/evolution";
import {
  detectMediaType,
  downloadMediaFromEvolution,
  transcribeAudioWithGemini,
  analyzeImageWithGemini,
  analyzeDocumentWithGemini,
  generateSpeechWithGemini,
} from "@/lib/media";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, data } = body;

    // 1. Ignorar se o evento for diferente de messages.upsert
    if (event !== "messages.upsert") {
      return NextResponse.json({ ok: true, ignored: "evento_nao_suportado" });
    }

    if (!data || !data.key || !data.key.remoteJid) {
      return NextResponse.json({ ok: true, ignored: "payload_incompleto_ou_sem_remoteJid" });
    }

    const { remoteJid, fromMe } = data.key;

    // 2. Ignorar mensagens enviadas por nós mesmos
    if (fromMe === true) {
      return NextResponse.json({ ok: true, ignored: "mensagem_propria" });
    }

    // 3. Ignorar grupos
    if (remoteJid.includes("@g.us")) {
      return NextResponse.json({ ok: true, ignored: "mensagem_grupo" });
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

    // 11. Salvar mensagem do usuário com metadados de mídia
    await prisma.message.create({
      data: {
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

    // 14. Gerar resposta de texto com IA
    const aiResult = await generateResponse(
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

      if (shouldSendAudio && config.geminiApiKey) {
        try {
          const audioBase64 = await generateSpeechWithGemini(
            aiResult.content,
            config.geminiApiKey,
            (config as any).ttsVoice || "Kore"
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
          }
        } catch (ttsErr: any) {
          console.warn("[Webhook] Falha no TTS Gemini, fazendo fallback para texto:", ttsErr.message);
        }
      }

      // Fallback: enviar texto se áudio não foi enviado
      if (!audioSent) {
        await sendWhatsAppMessage(
          config.evolutionUrl,
          config.evolutionApiKey,
          config.instanceId,
          remoteJid,
          aiResult.content
        );
      }
    } else {
      console.warn("[Webhook] Evolution API não configurada. Resposta de IA não entregue.");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Error] Falha fatal no webhook:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
