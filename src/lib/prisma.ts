import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  let dbPath = "./dev.db";
  
  if (dbUrl.startsWith("file:")) {
    dbPath = dbUrl.substring(5);
  } else {
    // Se a variável estiver configurada incorretamente com postgres/mysql antigo, aplica fallback seguro
    const isDocker = require("fs").existsSync("/app/data");
    dbPath = isDocker ? "/app/data/prod.db" : "./dev.db";
    console.warn(`\n[Prisma Client] [AVISO CRÍTICO] A variável DATABASE_URL está incorreta ("${dbUrl}").`);
    console.warn(`[Prisma Client] O banco de dados SQLite requer o prefixo "file:". Aplicando fallback de segurança para: "${dbPath}"\n`);
  }
  
  const absolutePath = path.resolve(dbPath);
  console.log(`[Prisma Client] Conectando ao SQLite via Driver Adapter em: ${absolutePath}`);
  
  const adapter = new PrismaBetterSqlite3({
    url: `file:${absolutePath}`,
    timeout: 10000,
  });
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
