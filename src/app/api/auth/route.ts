import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { 
  getClientIp, 
  isIpLocked, 
  isGlobalLocked, 
  verifyAdminPassword, 
  registerFailedAttempt, 
  resetSecurityAttempts 
} from "@/lib/security";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    
    // 1. Verifica bloqueio global
    const globalLock = isGlobalLocked();
    if (globalLock.locked) {
      return NextResponse.json(
        { error: `Login temporariamente bloqueado globalmente. Tente novamente em ${globalLock.remaining}s.` },
        { status: 423 }
      );
    }

    // 2. Verifica bloqueio de IP
    const ipLock = isIpLocked(ip);
    if (ipLock.locked) {
      return NextResponse.json(
        { error: `Seu endereço de IP está bloqueado devido a múltiplas tentativas incorretas. Tente novamente em ${ipLock.remaining}s.` },
        { status: 429 }
      );
    }

    const { password } = await req.json();

    // 3. Valida senha dinâmica
    const isValid = await verifyAdminPassword(password);

    if (isValid) {
      // Limpa tentativas falhas
      resetSecurityAttempts(ip);

      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, createSession(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 dias
      });

      return NextResponse.json({ success: true });
    }

    // 4. Se falhou, registra tentativa
    const result = await registerFailedAttempt(ip);
    if (result.killSwitchTriggered) {
      return NextResponse.json(
        { error: "Ataque massivo detectado! O sistema de autodefesa foi acionado e chaves de API foram deletadas preventivamente. Login congelado." },
        { status: 403 }
      );
    }
    
    if (result.ipLocked) {
      return NextResponse.json(
        { error: "Senha incorreta. Seu IP foi bloqueado por 15 minutos após exceder o limite de tentativas." },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
