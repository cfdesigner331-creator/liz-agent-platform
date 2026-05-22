import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { generateResponse } from "@/lib/openai";

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

    // Busca a configuração do agente para API keys
    const config = await prisma.agentConfig.findFirst();
    if (!config) {
      return NextResponse.json({ error: "Configuração do agente não encontrada" }, { status: 400 });
    }

    // Monta o histórico legível
    const historyText = conversation.messages
      .map((msg) => {
        const role = msg.role === "user" ? "Cliente" : "Liz (IA)";
        return `${role}: ${msg.content}`;
      })
      .join("\n");

    const totalMessages = conversation.messages.length;
    const userMessages = conversation.messages.filter((m) => m.role === "user").length;
    const totalTokens = conversation.messages.reduce((acc, m) => acc + (m.tokens || 0), 0);

    const promptText = `Analise esta conversa de atendimento comercial e gere um resumo executivo em português, em formato JSON com os seguintes campos:
- "nome": nome do cliente (se mencionado, senão null)
- "interesse": produto ou serviço de interesse principal
- "quantidade": quantidade solicitada (se mencionada, senão null)
- "status": status da negociação em uma palavra ("em_andamento" | "fechado" | "perdido" | "qualificado" | "pendente")
- "pontosPrincipais": array de strings com os 3-5 pontos mais relevantes da conversa
- "proximosPassos": string com o que deve ser feito na sequência (ou null se concluído)
- "resumo": parágrafo de 2-3 frases resumindo toda a conversa

Responda APENAS com o JSON válido, sem markdown ou explicações.

CONVERSA:
${historyText}`;

    // Mapeia provedores disponíveis com suas respectivas chaves
    const activeProvider = config.aiProvider || "openai";
    const allProviders = [
      {
        name: "gemini",
        key: config.geminiApiKey || "",
        model: config.geminiModel || "gemini-2.5-flash-lite",
      },
      {
        name: "groq",
        key: config.groqApiKey || "",
        model: config.groqModel || "llama-3.3-70b-versatile",
      },
      {
        name: "openai",
        key: config.openaiApiKey || "",
        model: config.openaiModel || "gpt-4.1-mini",
      },
    ];

    // Ordena as tentativas: tenta o provedor ativo primeiro, depois os outros com chaves configuradas
    const providersToTry: { name: string; key: string; model: string }[] = [];
    const primary = allProviders.find((p) => p.name === activeProvider);
    if (primary && primary.key && primary.key.trim() !== "") {
      providersToTry.push(primary);
    }
    allProviders.forEach((p) => {
      if (p.name !== activeProvider && p.key && p.key.trim() !== "") {
        providersToTry.push(p);
      }
    });

    // Se nenhum dos anteriores tinha chaves cadastradas, insere qualquer um que tenha chave
    if (providersToTry.length === 0) {
      allProviders.forEach((p) => {
        if (p.key && p.key.trim() !== "") providersToTry.push(p);
      });
    }

    let rawText = "";
    let success = false;
    let usedProvider = "";

    // Executa as tentativas com failover transparente
    for (const provider of providersToTry) {
      try {
        console.log(`[Summary API] Tentando gerar resumo com o provedor: ${provider.name}`);
        const response = await generateResponse(
          [{ role: "user", content: promptText }],
          "Você é um assistente analítico encarregado de resumir conversas comerciais em formato JSON.",
          0.2,
          1024,
          {
            aiProvider: provider.name,
            geminiApiKey: config.geminiApiKey || "",
            geminiModel: config.geminiModel || "gemini-2.5-flash-lite",
            groqApiKey: config.groqApiKey || "",
            groqModel: config.groqModel || "llama-3.3-70b-versatile",
            openaiApiKey: config.openaiApiKey || "",
            openaiModel: config.openaiModel || "gpt-4.1-mini",
          }
        );
        if (response && response.content) {
          rawText = response.content;
          usedProvider = provider.name;
          success = true;
          console.log(`[Summary API] Resumo gerado com sucesso usando o provedor: ${provider.name}`);
          break;
        }
      } catch (err: any) {
        console.error(`[Summary API] Falha no provedor ${provider.name}:`, err.message);
      }
    }

    // Se todos falharam, monta um resumo de contingência local para não quebrar a tela
    if (!success) {
      console.warn("[Summary API] Todos os provedores de IA falharam. Retornando resumo de contingência.");
      rawText = JSON.stringify({
        nome: conversation.phone.replace("@s.whatsapp.net", ""),
        interesse: "Não determinado (Erro de IA)",
        quantidade: null,
        status: "pendente",
        pontosPrincipais: [
          `A conversa contém ${totalMessages} mensagens no total.`,
          `O cliente enviou ${userMessages} mensagens.`,
          "A IA da Liz atendeu e respondeu ativamente ao cliente.",
          "Nota: O resumo automático por Inteligência Artificial falhou temporariamente devido a limite de cotas do provedor."
        ],
        proximosPassos: "Revisar histórico manualmente ou recarregar a página em instantes.",
        resumo: `Conversa de atendimento comercial com ${totalMessages} mensagens no total. No momento, o serviço de inteligência artificial de resumo está indisponível ou com limite de cotas esgotado. Por favor, tente novamente mais tarde.`
      });
      usedProvider = "fallback-local";
    }

    let summaryData: any = null;
    try {
      const cleanedText = rawText.trim() || "{}";
      const jsonText = cleanedText.replace(/^```json?\n?/i, "").replace(/\n?```$/, "").trim();
      summaryData = JSON.parse(jsonText);
    } catch {
      summaryData = { 
        resumo: rawText.trim() || "Não foi possível estruturar o resumo.",
        status: "pendente",
        pontosPrincipais: ["Análise de atendimento finalizada."],
        proximosPassos: "Verificar histórico completo."
      };
    }

    return NextResponse.json({
      conversationId: id,
      phone: conversation.phone,
      totalMessages,
      userMessages,
      totalTokens,
      usedProvider,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      summary: summaryData,
    });
  } catch (err: any) {
    console.error("[Summary API] Erro crítico:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
