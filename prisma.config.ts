try {
  // Carrega dotenv dinamicamente se disponível (desenvolvimento local)
  await import("dotenv/config");
} catch (err) {
  // Em produção (contêiner Docker / EasyPanel), as variáveis de ambiente
  // já são injetadas diretamente no shell do sistema operacional.
}

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
