import { prisma } from "./prisma";
import { generateResponse } from "./openai";

/**
 * Analisa as interações recentes e gera sugestões de melhoria para o System Prompt.
 */
export async function generateSuggestionsFromHistory(): Promise<string[]> {
  const config = await prisma.agentConfig.findFirst();
  if (!config) {
    throw new Error("Configuração do agente não encontrada.");
  }

  // Busca as últimas 150 mensagens para análise de aprendizado
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  if (messages.length === 0) {
    return ["Sem mensagens suficientes no histórico para análise operacional."];
  }

  // Reverte para ordem cronológica e formata
  const formattedHistory = messages
    .reverse()
    .map((msg) => `${msg.role === "user" ? "Cliente" : "Liz (IA)"}: ${msg.content}`)
    .join("\n");

  const promptText = `Você é o Diretor de Aprendizado Operacional da Liz. Analise o histórico recente de interações e identifique pontos onde a Liz falhou, dúvidas frequentes não respondidas, ou novos padrões de atendimento.
Gere de 1 a 3 sugestões concretas, curtas e acionáveis de melhoria para o System Prompt da assistente.

Exemplos de boas sugestões:
- "Incluir informação de que Silk-Screen exige no mínimo 20 peças."
- "Adicionar que aceitamos pagamentos via PIX ou faturamento em 2x."
- "Esclarecer que o prazo de confecção para moletons é de 15 dias úteis."

Retorne APENAS um JSON válido no formato abaixo, sem markdown ou explicações:
{
  "sugestoes": [
    "sugestao 1",
    "sugestao 2"
  ]
}

HISTÓRICO RECENTE:
${formattedHistory}`;

  try {
    const response = await generateResponse(
      [{ role: "user", content: promptText }],
      "Você é um analista experiente encarregado de otimizar prompts de atendimento com base em conversas reais.",
      0.3,
      1024,
      {
        aiProvider: config.aiProvider,
        geminiApiKey: config.geminiApiKey,
        geminiModel: config.geminiModel,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel,
        openaiApiKey: config.openaiApiKey,
        openaiModel: config.openaiModel,
      }
    );

    const cleanedText = (response?.content || "").trim();
    const jsonText = cleanedText.replace(/^```json?\n?/i, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(jsonText);
    const suggestions = result.sugestoes || [];

    if (Array.isArray(suggestions) && suggestions.length > 0) {
      // Grava no banco
      for (const item of suggestions) {
        if (item && item.trim()) {
          await prisma.suggestion.create({
            data: { content: item.trim() },
          });
        }
      }
      return suggestions;
    }
    return [];
  } catch (err: any) {
    console.error("[Learning System] Falha ao gerar sugestões:", err.message);
    throw err;
  }
}

/**
 * Compila todas as sugestões do banco e gera um novo system prompt consolidated.
 */
export async function compileSuggestionsIntoPrompt(): Promise<string> {
  const config = await prisma.agentConfig.findFirst();
  if (!config) {
    throw new Error("Configuração do agente não encontrada.");
  }

  // Busca todas as sugestões
  const suggestions = await prisma.suggestion.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (suggestions.length === 0) {
    return config.systemPrompt;
  }

  const listText = suggestions
    .map((s, idx) => `${idx + 1}. [Criada em ${s.createdAt.toLocaleDateString("pt-BR")}] - ${s.content}`)
    .join("\n");

  const promptText = `Você é um Engenheiro de Prompt sênior. O sistema de aprendizado coletou as seguintes sugestões de melhorias baseadas no histórico real de atendimentos:

[SUGESTÕES DE MELHORIA]
${listText}

Reescreva o System Prompt atual da assistente integrando todas essas melhorias e regras adicionais de forma perfeitamente fluida e harmoniosa.
Mantenha rigorosamente toda a estrutura existente, regras de minutos/plantão, o tom e a persona da Liz, incorporando apenas as novas regras sugeridas nos tópicos correspondentes.
Retorne APENAS o novo System Prompt completo atualizado, sem qualquer introdução, explicação ou tags markdown.

PROMPT ATUAL:
${config.systemPrompt}`;

  try {
    const response = await generateResponse(
      [{ role: "user", content: promptText }],
      "Você é um especialista em otimização e consolidação de prompts de sistema.",
      0.2,
      4000,
      {
        aiProvider: config.aiProvider,
        geminiApiKey: config.geminiApiKey,
        geminiModel: config.geminiModel,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel,
        openaiApiKey: config.openaiApiKey,
        openaiModel: config.openaiModel,
      }
    );

    const newPrompt = (response?.content || "").trim();

    if (newPrompt && newPrompt.length > 200) {
      // Atualiza o prompt no banco, zera as sugestões processadas e reseta data do ciclo
      await prisma.$transaction([
        prisma.agentConfig.update({
          where: { id: config.id },
          data: {
            systemPrompt: newPrompt,
            lastPromptUpdateFromSuggestions: new Date(),
          },
        }),
        prisma.suggestion.deleteMany({}), // Limpa sugestões já consolidadas
      ]);

      console.log("[Learning System] Novo System Prompt compilado com sucesso a partir das sugestões e banco limpo.");
      return newPrompt;
    }

    throw new Error("Resposta da IA foi muito curta ou inválida.");
  } catch (err: any) {
    console.error("[Learning System] Falha ao compilar sugestões no prompt:", err.message);
    throw err;
  }
}

/**
 * Verifica se já se passaram 7 dias desde a última atualização do prompt via sugestões.
 * Se sim, roda a compilação automática.
 */
export async function checkAndAutoCompilePrompt(): Promise<boolean> {
  try {
    const config = await prisma.agentConfig.findFirst();
    if (!config) return false;

    const lastUpdate = new Date(config.lastPromptUpdateFromSuggestions || config.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 7) {
      console.log(`[Learning System] Alerta: Ciclo de 7 dias atingido (${diffDays} dias). Compilando novo system prompt de forma automática...`);
      await compileSuggestionsIntoPrompt();
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn("[Learning System] Erro durante verificação de ciclo de 7 dias:", err.message);
    return false;
  }
}
