import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  let dbPath = "./dev.db";
  
  if (dbUrl.startsWith("file:")) {
    dbPath = dbUrl.substring(5);
  }
  
  const absolutePath = path.resolve(dbPath);
  console.log(`[Prisma Client] Conectando ao SQLite via Driver Adapter em: ${absolutePath}`);
  
  const sqlite = new Database(absolutePath, { timeout: 10000 });
  // Otimiza concorrência de leitura/escrita em SQLite usando WAL Mode
  sqlite.pragma("journal_mode = WAL");
  
  const adapter = new PrismaBetterSqlite3(sqlite);
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
