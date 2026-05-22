import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.agentConfig.findFirst();
  console.log("=== CONFIGURAÇÃO DO AGENTE ===");
  if (!config) {
    console.log("Nenhuma configuração encontrada.");
  } else {
    console.log(JSON.stringify({
      id: config.id,
      name: config.name,
      enabled: config.enabled,
      aiProvider: config.aiProvider,
      openaiModel: config.openaiModel,
      geminiModel: config.geminiModel,
      groqModel: config.groqModel,
      audioResponseMode: config.audioResponseMode,
      scheduleEnabled: config.scheduleEnabled,
      scheduleMode: config.scheduleMode,
      // Omit keys partially for privacy, but show if they are populated
      hasOpenaiKey: !!config.openaiApiKey,
      hasGeminiKey: !!config.geminiApiKey,
      hasGroqKey: !!config.groqApiKey,
      hasEvolutionUrl: !!config.evolutionUrl,
      hasEvolutionKey: !!config.evolutionApiKey,
    }, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
