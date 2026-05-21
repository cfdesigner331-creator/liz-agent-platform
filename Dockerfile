# --- STAGE 1: INSTALL DEPENDENCIES ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# --- STAGE 2: BUILD NEXT.JS APPLICATION ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Desativa telemetria durante a compilação
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./dev.db"

# Executa o prisma generate para tipagens adequadas ao builder
RUN npx prisma generate
RUN npm run build

# --- STAGE 3: RUNTIME PRODUCTION ENVIRONMENT ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/prod.db"

# Cria pasta persistente do SQLite com permissões adequadas
RUN mkdir -p /app/data && chown -R node:nodejs /app

# Copia dependências executáveis necessárias
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/migrate.mjs ./migrate.mjs
COPY --from=builder /app/start.sh ./start.sh

# Copia arquivos compilados do Next.js standalone
COPY --from=builder --chown=node:nodejs /app/.next/standalone ./
COPY --from=builder --chown=node:nodejs /app/.next/static ./.next/static

# Torna start.sh executável
RUN chmod +x start.sh

# Roda o container com usuário restrito de segurança
USER node

EXPOSE 3000

ENTRYPOINT ["./start.sh"]
