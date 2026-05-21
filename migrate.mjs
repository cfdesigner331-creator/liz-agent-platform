import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

console.log("[Migrate] Inicializando migração nativa do banco de dados SQLite...");

try {
  // Garante que a pasta de dados do SQLite existe
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  let dbPath = "./dev.db";
  if (dbUrl.startsWith("file:")) {
    dbPath = dbUrl.substring(5);
  } else {
    // Se a variável estiver configurada incorretamente com postgres/mysql antigo, aplica fallback seguro
    const isDocker = fs.existsSync("/app/data");
    dbPath = isDocker ? "/app/data/prod.db" : "./dev.db";
    console.warn(`\n[Migrate] [AVISO CRÍTICO] A variável DATABASE_URL instalada no ambiente de produção está incorreta ("${dbUrl}").`);
    console.warn(`[Migrate] O banco de dados SQLite requer o prefixo "file:". Aplicando fallback de segurança para: "${dbPath}"\n`);
  }

  const resolvedDbPath = path.resolve(dbPath);
  const dbDir = path.dirname(resolvedDbPath);
  if (!fs.existsSync(dbDir)) {
    console.log(`[Migrate] Criando diretório de banco de dados: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[Migrate] Conectando ao SQLite via better-sqlite3 em: ${resolvedDbPath}`);
  const db = new Database(resolvedDbPath);
  
  // Habilita configurações padrão do SQLite
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  console.log("[Migrate] Sincronizando tabelas com o banco de dados...");
  
  db.transaction(() => {
    // Tabela AgentConfig
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "AgentConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL DEFAULT 'Assistente IA',
        "systemPrompt" TEXT NOT NULL DEFAULT 'Você é um assistente prestativo e amigável.',
        "temperature" REAL NOT NULL DEFAULT 0.7,
        "maxTokens" INTEGER NOT NULL DEFAULT 1024,
        "evolutionUrl" TEXT NOT NULL DEFAULT '',
        "evolutionApiKey" TEXT NOT NULL DEFAULT '',
        "instanceId" TEXT NOT NULL DEFAULT '',
        "historyLimit" INTEGER NOT NULL DEFAULT 10,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "allowedPhones" TEXT NOT NULL DEFAULT '',
        "aiProvider" TEXT NOT NULL DEFAULT 'openai',
        "openaiApiKey" TEXT NOT NULL DEFAULT '',
        "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
        "groqApiKey" TEXT NOT NULL DEFAULT '',
        "groqModel" TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
        "geminiApiKey" TEXT NOT NULL DEFAULT '',
        "geminiModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-lite',
        "audioResponseMode" TEXT NOT NULL DEFAULT 'on_audio',
        "ttsVoice" TEXT NOT NULL DEFAULT 'Kore',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `).run();

    // Tabela Conversation
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "Conversation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "source" TEXT NOT NULL DEFAULT 'chat',
        "phone" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `).run();

    // Tabela Message
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "Message" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "conversationId" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "tokens" INTEGER,
        "mediaType" TEXT,
        "mediaCaption" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `).run();
  })();

  // Verifica e adiciona dinamicamente colunas que podem estar faltando em instalações existentes
  try {
    const tableInfo = db.prepare("PRAGMA table_info('AgentConfig')").all();
    const columns = tableInfo.map(c => c.name);
    
    if (!columns.includes("geminiApiKey")) {
      console.log("[Migrate] Adicionando coluna 'geminiApiKey' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "geminiApiKey" TEXT NOT NULL DEFAULT ""').run();
    }
    if (!columns.includes("geminiModel")) {
      console.log("[Migrate] Adicionando coluna 'geminiModel' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "geminiModel" TEXT NOT NULL DEFAULT "gemini-2.5-flash-lite"').run();
    }
    if (!columns.includes("audioResponseMode")) {
      console.log("[Migrate] Adicionando coluna 'audioResponseMode' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "audioResponseMode" TEXT NOT NULL DEFAULT "on_audio"').run();
    }
    if (!columns.includes("ttsVoice")) {
      console.log("[Migrate] Adicionando coluna 'ttsVoice' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "ttsVoice" TEXT NOT NULL DEFAULT "Kore"').run();
    }
    if (!columns.includes("scheduleEnabled")) {
      console.log("[Migrate] Adicionando coluna 'scheduleEnabled' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false').run();
    }
    if (!columns.includes("scheduleTimezone")) {
      console.log("[Migrate] Adicionando coluna 'scheduleTimezone' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "scheduleTimezone" TEXT NOT NULL DEFAULT "America/Sao_Paulo"').run();
    }
    if (!columns.includes("scheduleDays")) {
      console.log("[Migrate] Adicionando coluna 'scheduleDays' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "scheduleDays" TEXT NOT NULL DEFAULT "[1,2,3,4,5]"').run();
    }
    if (!columns.includes("scheduleStartTime")) {
      console.log("[Migrate] Adicionando coluna 'scheduleStartTime' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "scheduleStartTime" TEXT NOT NULL DEFAULT "08:00"').run();
    }
    if (!columns.includes("scheduleEndTime")) {
      console.log("[Migrate] Adicionando coluna 'scheduleEndTime' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "scheduleEndTime" TEXT NOT NULL DEFAULT "18:00"').run();
    }
    if (!columns.includes("scheduleOffMessage")) {
      console.log("[Migrate] Adicionando coluna 'scheduleOffMessage' à tabela AgentConfig...");
      db.prepare('ALTER TABLE "AgentConfig" ADD COLUMN "scheduleOffMessage" TEXT NOT NULL DEFAULT "Olá! No momento estou fora do horário de atendimento. Em breve retornarei! 😊"').run();
    }

    // Message table new columns
    const msgInfo = db.prepare("PRAGMA table_info('Message')").all();
    const msgCols = msgInfo.map(c => c.name);
    if (!msgCols.includes("mediaType")) {
      console.log("[Migrate] Adicionando coluna 'mediaType' à tabela Message...");
      db.prepare('ALTER TABLE "Message" ADD COLUMN "mediaType" TEXT').run();
    }
    if (!msgCols.includes("mediaCaption")) {
      console.log("[Migrate] Adicionando coluna 'mediaCaption' à tabela Message...");
      db.prepare('ALTER TABLE "Message" ADD COLUMN "mediaCaption" TEXT').run();
    }
  } catch (alterErr) {
    console.warn("[Migrate] Aviso ao executar verificação estrutural (ALTER TABLE):", alterErr.message);
  }

  db.close();
  console.log("[Migrate] Banco de dados SQLite sincronizado com sucesso nativamente!");
} catch (err) {
  console.error("[Migrate] Falha crítica na migração nativa do banco de dados:", err);
  process.exit(1);
}
