import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Busca a conversa com todas as mensagens
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    // Busca a Gemini API key da config
    const config = await prisma.agentConfig.findFirst();
    if (!config || !(config as any).geminiApiKey) {
      return NextResponse.json({ error: "Gemini API Key não configurada" }, { status: 400 });
    }

    // Monta o histórico legível para o Gemini
    const historyText = conversation.messages
      .map((msg) => {
        const role = msg.role === "user" ? "Cliente" : "Liz (IA)";
        return `${role}: ${msg.content}`;
      })
      .join("\n");

    const totalMessages = conversation.messages.length;
    const userMessages = conversation.messages.filter((m) => m.role === "user").length;
    const totalTokens = conversation.messages.reduce((acc, m) => acc + (m.tokens || 0), 0);

    // Gera resumo com Gemini
    const ai = new GoogleGenAI({ apiKey: (config as any).geminiApiKey });
    const response = await ai.models.generateContent({
      model: (config as any).geminiModel || "gemini-2.5-flash-lite",
      contents: [
        {
          parts: [
            {
              text: `Analise esta conversa de atendimento comercial e gere um resumo executivo em português, em formato JSON com os seguintes campos:
- "nome": nome do cliente (se mencionado, senão null)
- "interesse": produto ou serviço de interesse principal
- "quantidade": quantidade solicitada (se mencionada, senão null)
- "status": status da negociação em uma palavra ("em_andamento" | "fechado" | "perdido" | "qualificado" | "pendente")
- "pontosPrincipais": array de strings com os 3-5 pontos mais relevantes da conversa
- "proximosPassos": string com o que deve ser feito na sequência (ou null se concluído)
- "resumo": parágrafo de 2-3 frases resumindo toda a conversa

Responda APENAS com o JSON válido, sem markdown ou explicações.

CONVERSA:
${historyText}`,
            },
          ],
        },
      ],
    });

    let summaryData: any = null;
    try {
      const rawText = response.text?.trim() || "{}";
      // Remove markdown code blocks se presentes
      const jsonText = rawText.replace(/^```json?\n?/i, "").replace(/\n?```$/, "").trim();
      summaryData = JSON.parse(jsonText);
    } catch {
      summaryData = { resumo: response.text?.trim() || "Não foi possível gerar o resumo." };
    }

    return NextResponse.json({
      conversationId: id,
      phone: conversation.phone,
      totalMessages,
      userMessages,
      totalTokens,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      summary: summaryData,
    });
  } catch (err: any) {
    console.error("[Summary API] Erro:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
