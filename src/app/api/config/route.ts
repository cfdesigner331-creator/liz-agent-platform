import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

const DEFAULT_PROMPT = `Você é a Liz, assistente de inteligência artificial da "Criações Freitas", uma confecção especializada em vestuário personalizado, estamparia premium e bordados industriais.

### 🌟 PERSONALIDADE E TOM
- Amigável, empolgada com arte, profissional, focada em design de estampas e moda.
- Use emojis moderadamente (🎨, 🌸, 👕, ✂️).
- Fale em português de forma fluida, natural, rápida e calorosa. Nunca pareça um robô engessado.

### 💼 DIRETRIZES DO NEGÓCIO
1. PRODUTOS QUE OFERECEMOS:
   - Camisetas Premium (Algodão Fio 30.1 Penteado ou Poliéster Toque de Algodão).
   - Moletons Flanelados Confort.
   - Uniformes Profissionais Customizados.
   - Eco-bags Ecológicas de Lona/Algodão.

2. MÉTODOS DE IMPRESSÃO / REGRAS:
   - **Sublimação**: Perfeito para fotos, artes com degradês ou coloridas. Feito em poliéster toque de algodão. **Mínimo: 1 peça.**
   - **Silk-Screen (Serigrafia)**: Perfeito para logos corporativos, estampas grandes com cores sólidas. **Mínimo: 20 peças.**
   - **Bordado Industrial**: Alta sofisticação, ideal para logotipos pequenos no peito. **Mínimo: 20 peças.**

3. CONDIÇÕES FINANCEIRAS:
   - Faturamento: 50% de sinal para dar entrada na produção física + 50% restantes antes da expedição e envio das peças.

### 📋 SCRIPT DE ATENDIMENTO E QUALIFICAÇÃO
Seu objetivo é coletar estes dados de forma natural ao longo do chat (não pergunte tudo de uma vez):
1. **Nome do Cliente**: Trate-o pelo nome assim que souber.
2. **Produto Desejado**: Camiseta, moletom, uniforme, etc.
3. **Tipo de Material**: Pergunte ou sugira conforme a estampa.
4. **Arte/Estampa**: Peça referências.
5. **Quantidade**: Pergunte as unidades desejadas (aplique a regra de pedido mínimo).
6. **E-mail de Contato**: Para formalização da ficha técnica e financeiro.

### ⚠️ DETECÇÃO DE FECHAMENTO (webhook trigger)
Assim que tiver todas as informações básicas coletadas (Nome, Produto, Quantidade, Tipo de Arte/Material e E-mail), encerre a conversa de forma amigável gerando um resumo detalhado como este:
📋 **Resumo da Solicitação:**
- **Nome:** [Nome]
- **Produto:** [Produto]
- **Estampa:** [Descrição da estampa]
- **Material:** [Material sugerido]
- **Quantidade:** [Quantidade]
- **Contato:** [E-mail]`;

function sanitizeConfig(config: any) {
  if (!config) return null;
  return {
    id: config.id,
    name: config.name || "Liz Agent",
    systemPrompt: config.systemPrompt || "",
    temperature: config.temperature ?? 0.4,
    maxTokens: config.maxTokens ?? 1024,
    evolutionUrl: config.evolutionUrl || "",
    evolutionApiKey: config.evolutionApiKey || "",
    instanceId: config.instanceId || "",
    historyLimit: config.historyLimit ?? 12,
    enabled: config.enabled ?? true,
    allowedPhones: config.allowedPhones || "",
    aiProvider: config.aiProvider || "openai",
    openaiApiKey: config.openaiApiKey || "",
    openaiModel: config.openaiModel || "gpt-4.1-mini",
    groqApiKey: config.groqApiKey || "",
    groqModel: config.groqModel || "llama-3.3-70b-versatile",
    geminiApiKey: config.geminiApiKey || "",
    geminiModel: config.geminiModel || "gemini-2.5-flash-lite",
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export async function GET(req: Request) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    let config = await prisma.agentConfig.findFirst();
    if (!config) {
      config = await prisma.agentConfig.create({
        data: {
          name: "Liz Agent",
          systemPrompt: DEFAULT_PROMPT,
          temperature: 0.4,
          maxTokens: 1024,
          historyLimit: 12,
          enabled: true,
          aiProvider: "openai",
          openaiModel: "gpt-4.1-mini",
          geminiModel: "gemini-2.5-flash-lite",
        },
      });
    }

    return NextResponse.json(sanitizeConfig(config));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { id, createdAt, updatedAt, ...configData } = data;
    
    // Filtra e força tipos/valores para garantir que nenhum nulo/undefined seja repassado ao Prisma
    const cleanConfigData = {
      name: configData.name || "Liz Agent",
      systemPrompt: configData.systemPrompt || "",
      temperature: Number(configData.temperature ?? 0.4),
      maxTokens: Number(configData.maxTokens ?? 1024),
      evolutionUrl: configData.evolutionUrl || "",
      evolutionApiKey: configData.evolutionApiKey || "",
      instanceId: configData.instanceId || "",
      historyLimit: Number(configData.historyLimit ?? 12),
      enabled: Boolean(configData.enabled ?? true),
      allowedPhones: configData.allowedPhones || "",
      aiProvider: configData.aiProvider || "openai",
      openaiApiKey: configData.openaiApiKey || "",
      openaiModel: configData.openaiModel || "gpt-4.1-mini",
      groqApiKey: configData.groqApiKey || "",
      groqModel: configData.groqModel || "llama-3.3-70b-versatile",
      geminiApiKey: configData.geminiApiKey || "",
      geminiModel: configData.geminiModel || "gemini-2.5-flash-lite",
    };

    let config = await prisma.agentConfig.findFirst();
    if (!config) {
      config = await prisma.agentConfig.create({
        data: cleanConfigData,
      });
    } else {
      config = await prisma.agentConfig.update({
        where: { id: config.id },
        data: cleanConfigData,
      });
    }

    return NextResponse.json(sanitizeConfig(config));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
