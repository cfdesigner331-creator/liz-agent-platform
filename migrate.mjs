import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log("[Migrate] Inicializando migração de banco de dados SQLite...");

try {
  // Garante que a pasta de dados do SQLite existe
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  if (dbUrl.startsWith("file:")) {
    const dbPath = dbUrl.substring(5);
    const dbDir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dbDir)) {
      console.log(`[Migrate] Criando diretório de banco de dados: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  // Roda o prisma db push para sincronizar o schema com o SQLite de forma direta
  console.log("[Migrate] Executando 'node node_modules/prisma/build/index.js db push'...");
  execSync("node node_modules/prisma/build/index.js db push", { stdio: "inherit" });
  console.log("[Migrate] Banco de dados SQLite sincronizado com sucesso!");
} catch (err) {
  console.error("[Migrate] Falha crítica ao migrar o banco de dados:", err);
  process.exit(1);
}
