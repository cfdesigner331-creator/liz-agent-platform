import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import {
  generateSuggestionsFromHistory,
  compileSuggestionsIntoPrompt,
} from "@/lib/learning";

export async function GET(req: Request) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const suggestions = await prisma.suggestion.findMany({
      orderBy: { createdAt: "desc" },
    });

    const config = await prisma.agentConfig.findFirst();

    return NextResponse.json({
      suggestions,
      lastPromptUpdateFromSuggestions: config?.lastPromptUpdateFromSuggestions || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const suggestions = await generateSuggestionsFromHistory();
    return NextResponse.json({ ok: true, suggestions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const newPrompt = await compileSuggestionsIntoPrompt();
    return NextResponse.json({ ok: true, systemPrompt: newPrompt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
