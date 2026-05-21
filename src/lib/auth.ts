import { cookies } from "next/headers";

export const SESSION_COOKIE = "agent_session";

// Token estático derivado do segredo para validação simples
const SESSION_TOKEN = process.env.NEXTAUTH_SECRET || "liz-secret-session-token-fixed";

export function createSession(): string {
  return SESSION_TOKEN;
}

export async function isAuthenticated(request?: Request): Promise<boolean> {
  // 1. Verificação via requisição HTTP direta (Route Handlers/Middleware)
  if (request) {
    const cookieHeader = request.headers.get("cookie") || "";
    const cookiesMap = Object.fromEntries(
      cookieHeader.split(";").map(c => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    return cookiesMap[SESSION_COOKIE] === SESSION_TOKEN;
  }
  
  // 2. Verificação via next/headers (Server Components/Server Actions)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    return token === SESSION_TOKEN;
  } catch (err) {
    // Fallback se não for ambiente de rendering de requisição
    return false;
  }
}
