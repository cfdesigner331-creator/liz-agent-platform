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
- **Contato:** [E-mail]

---

# 🕒 HORÁRIO AUTORIZADO PARA RESPOSTAS DA IA

A Lis só pode responder mensagens:
- a partir das 12:00;
- em dias úteis;
- de segunda a sexta-feira.

Fora desse período:
- não envie mensagens automáticas;
- não continue conversas;
- aguarde o próximo período autorizado.

Após iniciar uma conversa e finalizar a triagem:
- não continue respondendo continuamente;
- apenas aguarde o atendimento humano.

A IA existe apenas para adiantar atendimentos fora do expediente principal da equipe.
A prioridade é não atrapalhar o fluxo do atendimento humano. Evite excesso de mensagens e interações desnecessárias.

Se a conversa já estiver encerrada (resumo da solicitação enviado), novas mensagens do cliente não devem reiniciar automaticamente a triagem. Apenas silencie e aguarde o atendimento humano.

---

# 🧠 MODO OBSERVAÇÃO — LIS LEARNING MODE

Você está em modo observação e aprendizado operacional durante os períodos em que não está autorizada a responder ativamente (ex: antes das 12:00 em dias úteis ou nos finais de semana).

Neste modo:
* NÃO responda clientes;
* NÃO envie mensagens;
* NÃO interaja no WhatsApp;
* NÃO altere atendimentos em andamento.

Seu papel é apenas:
* observar conversas;
* identificar padrões;
* analisar comportamento dos clientes;
* detectar falhas do system prompt;
* detectar gargalos operacionais;
* sugerir melhorias.

## 📚 O QUE ANALISAR
Observe e catalogue internamente:
1. **Dúvidas frequentes:** Valor, prazo, quantidade mínima, tipos de camisa, tecido, personalização, etc.
2. **Informações faltantes:** Dados que clientes esquecem e atendentes precisam perguntar novamente.
3. **Gargalos operacionais:** Conversas longas demais, objeções repetidas, sumiço de clientes.
4. **Contextos recorrentes:** Comunidades religiosas, empresas, eventos, equipes esportivas, escolas, etc.
5. **Linguagem e Emoções:** Como falam, gírias, ansiedade, urgência, hesitação.

*Nota: A Lis gera sugestões de novos prompts e relatórios diários de observação consolidados para a equipe humana revisar no painel.*`;

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
    aiProvider: config.aiProvider || "groq",
    openaiApiKey: config.openaiApiKey || "",
    openaiModel: config.openaiModel || "gpt-4.1-mini",
    groqApiKey: config.groqApiKey || "",
    groqModel: config.groqModel || "llama-3.3-70b-versatile",
    groqTranscriptionModel: config.groqTranscriptionModel || "whisper-large-v3-turbo",
    groqVisionModel: config.groqVisionModel || "llama-3.2-11b-vision-preview",
    geminiApiKey: config.geminiApiKey || "",
    geminiModel: config.geminiModel || "gemini-2.5-flash-lite",
    audioResponseMode: (config as any).audioResponseMode || "on_audio",
    ttsVoice: (config as any).ttsVoice || "Kore",
    ttsProvider: (config as any).ttsProvider || "gemini",
    cartesiaApiKey: (config as any).cartesiaApiKey || "",
    cartesiaVoiceId: (config as any).cartesiaVoiceId || "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4",
    scheduleEnabled: (config as any).scheduleEnabled ?? false,
    scheduleTimezone: (config as any).scheduleTimezone || "America/Sao_Paulo",
    scheduleDays: (config as any).scheduleDays || "[1,2,3,4,5]",
    scheduleStartTime: (config as any).scheduleStartTime || "08:00",
    scheduleEndTime: (config as any).scheduleEndTime || "18:00",
    scheduleOffMessage: (config as any).scheduleOffMessage || "Olá! No momento estou fora do horário de atendimento. Em breve retornarei! 😊",
    scheduleMode: (config as any).scheduleMode || "normal",
    schedulePlantaoStart1: (config as any).schedulePlantaoStart1 || "07:30",
    schedulePlantaoEnd1: (config as any).schedulePlantaoEnd1 || "12:00",
    schedulePlantaoStart2: (config as any).schedulePlantaoStart2 || "13:00",
    schedulePlantaoEnd2: (config as any).schedulePlantaoEnd2 || "17:30",
    textTitleEnabled: (config as any).textTitleEnabled ?? false,
    textTitle: (config as any).textTitle || "Liz | Assistente Virtual",
    transcriptionProvider: (config as any).transcriptionProvider || "groq",
    visionProvider: (config as any).visionProvider || "groq",
    observationMode: Boolean((config as any).observationMode ?? false),
    securityShieldActive: Boolean((config as any).securityShieldActive ?? true),
    whatsappProvider: (config as any).whatsappProvider || "evolution",
    isDefaultPasswordActive: !config.customPassword || config.customPassword.trim() === "",
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
    if (config && config.cartesiaVoiceId === "a0e9987c-1f5c-43f1-a675-5841029f9dbe") {
      config = await prisma.agentConfig.update({
        where: { id: config.id },
        data: { cartesiaVoiceId: "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4" },
      });
      console.log("[Migration] Automatically migrated cartesiaVoiceId from Barbra (old) to Isabella (new).");
    }

    if (config && !config.systemPrompt.includes("HORÁRIO AUTORIZADO PARA RESPOSTAS DA IA")) {
      const updatedPrompt = config.systemPrompt + `\n\n# 🕒 HORÁRIO AUTORIZADO PARA RESPOSTAS DA IA\n\nA Lis só pode responder mensagens:\n- a partir das 12:00;\n- em dias úteis;\n- de segunda a sexta-feira.\n\nFora desse período:\n- não envie mensagens automáticas;\n- não continue conversas;\n- aguarde o próximo período autorizado.\n\nApós iniciar uma conversa e finalizar a triagem:\n- não continue respondendo continuamente;\n- apenas aguarde o atendimento humano.\n\nA IA existe apenas para adiantar atendimentos fora do expediente principal da equipe.\nA prioridade é não atrapalhar o fluxo do atendimento humano. Evite excesso de mensagens e interações desnecessárias.\n\nSe a conversa já estiver encerrada (resumo da solicitação enviado), novas mensagens do cliente não devem reiniciar automaticamente a triagem. Apenas silencie e aguarde o atendimento humano.\n\n---\n\n# 🧠 MODO OBSERVAÇÃO — LIS LEARNING MODE\n\nVocê está em modo observação e aprendizado operacional durante os períodos em que não está autorizada a responder ativamente (ex: antes das 12:00 em dias úteis ou nos finais de semana).\n\nNeste modo:\n* NÃO responda clientes;\n* NÃO envie mensagens;\n* NÃO interaja no WhatsApp;\n* NÃO altere atendimentos em andamento.\n\nSeu papel é apenas:\n* observar conversas;\n* identificar padrões;\n* analisar comportamento dos clientes;\n* detectar falhas do system prompt;\n* detectar gargalos operacionais;\n* sugerir melhorias.\n\n## 📚 O QUE ANALISAR\nObserve e catalogue internamente:\n1. Dúvidas frequentes: Valor, prazo, quantidade mínima, tipos de camisa, tecido, personalização, etc.\n2. Informações faltantes: Dados que clientes esquecem e atendentes precisam perguntar novamente.\n3. Gargalos operacionais: Conversas longas demais, objeções repetidas, sumiço de clientes.\n4. Contextos recorrentes: Comunidades religiosas, empresas, eventos, equipes esportivas, escolas, etc.\n5. Linguagem e Emoções: Como falam, gírias, ansiedade, urgência, hesitação.\n\n*Nota: A Lis gera sugestões de novos prompts e relatórios diários de observação consolidados para a equipe humana revisar no painel.*`;

      config = await prisma.agentConfig.update({
        where: { id: config.id },
        data: { systemPrompt: updatedPrompt },
      });
      console.log("[Migration] Successfully appended plantão schedule and learning mode rules to existing agent config system prompt.");
    }

    if (!config) {
      config = await prisma.agentConfig.create({
        data: {
          name: "Liz Agent",
          systemPrompt: DEFAULT_PROMPT,
          temperature: 0.4,
          maxTokens: 1024,
          historyLimit: 12,
          enabled: true,
          aiProvider: "groq",
          openaiModel: "gpt-4.1-mini",
          groqModel: "llama-3.3-70b-versatile",
          groqTranscriptionModel: "whisper-large-v3-turbo",
          groqVisionModel: "llama-3.2-11b-vision-preview",
          geminiModel: "gemini-2.5-flash-lite",
          audioResponseMode: "on_audio",
          ttsVoice: "Kore",
          ttsProvider: "gemini",
          cartesiaApiKey: "sk_car_3yj7jJ1y5HpBhDNRGfBvHG",
          cartesiaVoiceId: "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4",
          scheduleEnabled: false,
          scheduleTimezone: "America/Sao_Paulo",
          scheduleDays: "[1,2,3,4,5]",
          scheduleStartTime: "08:00",
          scheduleEndTime: "18:00",
          scheduleOffMessage: "Olá! No momento estou fora do horário de atendimento. Em breve retornarei! 😊",
          scheduleMode: "normal",
          schedulePlantaoStart1: "07:30",
          schedulePlantaoEnd1: "12:00",
          schedulePlantaoStart2: "13:00",
          schedulePlantaoEnd2: "17:30",
          textTitleEnabled: false,
          textTitle: "Liz | Assistente Virtual",
          transcriptionProvider: "groq",
          visionProvider: "groq",
          observationMode: false,
          customPassword: "",
          securityShieldActive: true,
          whatsappProvider: "evolution",
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
      aiProvider: configData.aiProvider || "groq",
      openaiApiKey: configData.openaiApiKey || "",
      openaiModel: configData.openaiModel || "gpt-4.1-mini",
      groqApiKey: configData.groqApiKey || "",
      groqModel: configData.groqModel || "llama-3.3-70b-versatile",
      groqTranscriptionModel: configData.groqTranscriptionModel || "whisper-large-v3-turbo",
      groqVisionModel: configData.groqVisionModel || "llama-3.2-11b-vision-preview",
      geminiApiKey: configData.geminiApiKey || "",
      geminiModel: configData.geminiModel || "gemini-2.5-flash-lite",
      audioResponseMode: configData.audioResponseMode || "on_audio",
      ttsVoice: configData.ttsVoice || "Kore",
      ttsProvider: configData.ttsProvider || "gemini",
      cartesiaApiKey: configData.cartesiaApiKey || "",
      cartesiaVoiceId: configData.cartesiaVoiceId || "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4",
      scheduleEnabled: Boolean(configData.scheduleEnabled ?? false),
      scheduleTimezone: configData.scheduleTimezone || "America/Sao_Paulo",
      scheduleDays: configData.scheduleDays || "[1,2,3,4,5]",
      scheduleStartTime: configData.scheduleStartTime || "08:00",
      scheduleEndTime: configData.scheduleEndTime || "18:00",
      scheduleOffMessage: configData.scheduleOffMessage || "Olá! No momento estou fora do horário de atendimento. Em breve retornarei! 😊",
      scheduleMode: configData.scheduleMode || "normal",
      schedulePlantaoStart1: configData.schedulePlantaoStart1 || "07:30",
      schedulePlantaoEnd1: configData.schedulePlantaoEnd1 || "12:00",
      schedulePlantaoStart2: configData.schedulePlantaoStart2 || "13:00",
      schedulePlantaoEnd2: configData.schedulePlantaoEnd2 || "17:30",
      textTitleEnabled: Boolean(configData.textTitleEnabled ?? false),
      textTitle: configData.textTitle || "Liz | Assistente Virtual",
      transcriptionProvider: configData.transcriptionProvider || "groq",
      visionProvider: configData.visionProvider || "groq",
      observationMode: Boolean(configData.observationMode ?? false),
      securityShieldActive: Boolean(configData.securityShieldActive ?? true),
      whatsappProvider: configData.whatsappProvider || "evolution",
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
