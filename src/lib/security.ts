import { prisma } from "./prisma";

// Armazenamento em memória (in-memory singletons para o ciclo de vida do servidor)
interface AttemptTracker {
  count: number;
  lockedUntil: number;
}

const failedAttemptsByIP = new Map<string, AttemptTracker>();
let globalFailedAttempts: AttemptTracker = { count: 0, lockedUntil: 0 };

const IP_LIMIT = 5;
const GLOBAL_LIMIT = 10;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutos em milissegundos

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  
  return "127.0.0.1";
}

export function isIpLocked(ip: string): { locked: boolean; remaining: number } {
  const now = Date.now();
  const tracker = failedAttemptsByIP.get(ip);
  if (tracker && tracker.lockedUntil > now) {
    return { locked: true, remaining: Math.ceil((tracker.lockedUntil - now) / 1000) };
  }
  return { locked: false, remaining: 0 };
}

export function isGlobalLocked(): { locked: boolean; remaining: number } {
  const now = Date.now();
  if (globalFailedAttempts.lockedUntil > now) {
    return { locked: true, remaining: Math.ceil((globalFailedAttempts.lockedUntil - now) / 1000) };
  }
  return { locked: false, remaining: 0 };
}

/**
 * Zera tentativas falhas após login bem-sucedido
 */
export function resetSecurityAttempts(ip: string) {
  failedAttemptsByIP.delete(ip);
  globalFailedAttempts = { count: 0, lockedUntil: 0 };
}

/**
 * Triga a auto-destruição apagando todas as chaves externas
 */
export async function triggerSecurityKillSwitch(): Promise<void> {
  console.error("🚨 [ESCUDO DE AUTODEFESA LIZ] Bruteforce detectado! Ativando Protocolo de Segurança: Wipando chaves de API do banco de dados...");
  
  const config = await prisma.agentConfig.findFirst();
  if (config) {
    await prisma.agentConfig.update({
      where: { id: config.id },
      data: {
        groqApiKey: "",
        openaiApiKey: "",
        geminiApiKey: "",
        cartesiaApiKey: "",
        evolutionApiKey: "",
      },
    });
  }
  
  // Congela os logins globais por 15 minutos adicionais
  globalFailedAttempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
}

/**
 * Registra tentativa falha e ativa escudos de autodefesa se necessário
 */
export async function registerFailedAttempt(ip: string): Promise<{ ipLocked: boolean; globalLocked: boolean; killSwitchTriggered: boolean }> {
  const now = Date.now();
  
  // Busca se o escudo está ativo no banco
  const config = await prisma.agentConfig.findFirst();
  const shieldActive = config ? config.securityShieldActive : true;

  if (!shieldActive) {
    return { ipLocked: false, globalLocked: false, killSwitchTriggered: false };
  }

  // 1. IP Tracker
  let ipTracker = failedAttemptsByIP.get(ip) || { count: 0, lockedUntil: 0 };
  if (ipTracker.lockedUntil <= now) {
    ipTracker.count += 1;
    if (ipTracker.count >= IP_LIMIT) {
      ipTracker.lockedUntil = now + LOCKOUT_DURATION;
      console.warn(`⚠️ [ESCUDO DE AUTODEFESA] IP ${ip} bloqueado temporariamente por excesso de tentativas.`);
    }
    failedAttemptsByIP.set(ip, ipTracker);
  }

  // 2. Global Tracker
  let killSwitchTriggered = false;
  if (globalFailedAttempts.lockedUntil <= now) {
    globalFailedAttempts.count += 1;
    if (globalFailedAttempts.count >= GLOBAL_LIMIT) {
      globalFailedAttempts.lockedUntil = now + LOCKOUT_DURATION;
      killSwitchTriggered = true;
      await triggerSecurityKillSwitch();
    }
  }

  return {
    ipLocked: ipTracker.lockedUntil > now,
    globalLocked: globalFailedAttempts.lockedUntil > now,
    killSwitchTriggered
  };
}

/**
 * Valida a senha fornecida comparando com o banco ou com a de ambiente/padrão
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const config = await prisma.agentConfig.findFirst();
  const defaultPassword = process.env.ADMIN_PASSWORD || "FreitasAdmin99";
  
  if (config && config.customPassword && config.customPassword.trim() !== "") {
    return password === config.customPassword;
  }
  
  return password === defaultPassword;
}
