import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { generateResponse } from "@/lib/openai";

export async function GET(req: Request) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { source: "chat" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(conversations);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { conversationId, message } = await req.json();
    if (!message || message.trim() === "") {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { source: "chat" },
      });
    }

    // Salva a mensagem do usuário
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: message.trim(),
      },
    });

    // Carrega a configuração do agente
    const config = await prisma.agentConfig.findFirst();
    const systemPrompt = config?.systemPrompt || "Você é a Liz, assistente de inteligência artificial da Criações Freitas...";
    const temperature = config?.temperature ?? 0.4;
    const maxTokens = config?.maxTokens ?? 1024;
    const historyLimit = config?.historyLimit ?? 10;

    // Busca o histórico limitado de mensagens da conversa (últimas N mensagens)
    const dbMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: historyLimit,
    });
    
    // Inverte o array para ordem cronológica ascendente
    const chatHistory = dbMessages.reverse().map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Executa a IA (Wrapper compatível OpenAI e Groq)
    const aiResult = await generateResponse(
      chatHistory,
      systemPrompt,
      temperature,
      maxTokens,
      {
        aiProvider: config?.aiProvider,
        openaiApiKey: config?.openaiApiKey,
        openaiModel: config?.openaiModel,
        groqApiKey: config?.groqApiKey,
        groqModel: config?.groqModel,
      }
    );

    // Salva a resposta da IA no banco
    const modelMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "model",
        content: aiResult.content,
        tokens: aiResult.tokens,
      },
    });

    // Atualiza o updatedAt da conversa
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      message: modelMsg,
    });
  } catch (err: any) {
    console.error("[Playground Chat Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
