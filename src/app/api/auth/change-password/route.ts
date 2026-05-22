import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyAdminPassword } from "@/lib/security";

export async function POST(req: Request) {
  try {
    // 1. Verifica autenticação
    if (!(await isAuthenticated(req))) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!newPassword || newPassword.trim() === "") {
      return NextResponse.json({ error: "Nova senha não pode ser vazia" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "A nova senha deve ter no mínimo 6 caracteres" }, { status: 400 });
    }

    // 2. Valida senha atual
    const isCurrentValid = await verifyAdminPassword(currentPassword);
    if (!isCurrentValid) {
      return NextResponse.json({ error: "A senha atual informada está incorreta" }, { status: 400 });
    }

    // 3. Atualiza no banco
    const config = await prisma.agentConfig.findFirst();
    if (!config) {
      return NextResponse.json({ error: "Configuração do agente não encontrada" }, { status: 404 });
    }

    await prisma.agentConfig.update({
      where: { id: config.id },
      data: {
        customPassword: newPassword,
      },
    });

    return NextResponse.json({ success: true, message: "Senha alterada com sucesso!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
