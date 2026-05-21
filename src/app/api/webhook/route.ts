import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/lib/openai";
import { sendWhatsAppMessage } from "@/lib/evolution";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, data } = body;

    // 1. Ignorar se o evento for diferente de messages.upsert
    if (event !== "messages.upsert") {
      return NextResponse.json({ ok: true, ignored: "evento_nao_suportado" });
    }

    if (!data || !data.key) {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const { remoteJid, fromMe } = data.key;

    // 2. Ignorar se for enviada por nos mesmos (fromMe === true)
    if (fromMe === true) {
      return NextResponse.json({ ok: true, ignored: "mensagem_propria" });
    }

    // 3. Ignorar se remoteJid contiver @g.us (grupos)
    if (remoteJid.includes("@g.us")) {
      return NextResponse.json({ ok: true, ignored: "mensagem_grupo" });
    }

    // 4. phone = remoteJid sem o sufixo @s.whatsapp.net
    const phone = remoteJid.replace("@s.whatsapp.net", "");

    // 5. Texto da mensagem (resiliente para conversation, extendedTextMessage ou caption de imagens/videos)
    const messageContent = data.message;
    let userMessageText = "";

    if (messageContent) {
      if (messageContent.conversation) {
        userMessageText = messageContent.conversation;
      } else if (messageContent.extendedTextMessage?.text) {
        userMessageText = messageContent.extendedTextMessage.text;
      } else if (messageContent.imageMessage?.caption) {
        userMessageText = messageContent.imageMessage.caption;
      } else if (messageContent.videoMessage?.caption) {
        userMessageText = messageContent.videoMessage.caption;
      }
    }

    // Se a mensagem for completamente vazia (ex: reacoes ou mídias sem legenda), ignora
    if (!userMessageText || userMessageText.trim() === "") {
      return NextResponse.json({ ok: true, ignored: "mensagem_vazia" });
    }

    // 6. Carregar config do SQLite; ignorar se enabled === false
    const config = await prisma.agentConfig.findFirst();
    if (!config || config.enabled === false) {
      return NextResponse.json({ ok: true, ignored: "agente_desativado" });
    }

    // 7. Se allowedPhones nao vazio, verificar se phone esta na lista CSV
    if (config.allowedPhones && config.allowedPhones.trim() !== "") {
      const allowedList = config.allowedPhones
        .split(",")
        .map(p => p.trim().replace("+", ""));
      const cleanPhone = phone.replace("+", "");
      
      const isAllowed = allowedList.some(allowed => cleanPhone.includes(allowed));
      if (!isAllowed) {
        return NextResponse.json({ ok: true, ignored: "telefone_nao_permitido" });
      }
    }

    // 8. Buscar ou criar Conversation (source: "whatsapp", phone)
    let conversation = await prisma.conversation.findFirst({
      where: {
        source: "whatsapp",
        phone: phone,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          source: "whatsapp",
          phone: phone,
        },
      });
    }

    // 9. Salvar Message do usuario
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: userMessageText.trim(),
      },
    });

    // 10. Buscar historico de mensagens ordenadas por data
    const historyLimit = config.historyLimit || 10;
    const dbMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: historyLimit,
    });
    
    // Inverte para ficar em ordem cronologica ascendente
    const chatHistory = dbMessages.reverse().map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // 11. generateResponse com OpenAI ou Groq compatível
    const aiResult = await generateResponse(
      chatHistory,
      config.systemPrompt,
      config.temperature,
      config.maxTokens,
      {
        aiProvider: config.aiProvider,
        openaiApiKey: config.openaiApiKey,
        openaiModel: config.openaiModel,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel,
      }
    );

    // 12. Salvar Message do assistente com os tokens
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "model",
        content: aiResult.content,
        tokens: aiResult.tokens,
      },
    });

    // Atualiza updatedAt da conversa
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // 13. sendWhatsAppMessage com as credenciais da config
    if (config.evolutionUrl && config.evolutionApiKey && config.instanceId) {
      await sendWhatsAppMessage(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.instanceId,
        remoteJid, // remoteJid completo contendo @s.whatsapp.net é aceito pela Evolution
        aiResult.content
      );
    } else {
      console.warn("[Webhook] Evolution API nao configurada no SQLite. Resposta de IA nao entregue.");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Error] Falha fatal no webhook:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
