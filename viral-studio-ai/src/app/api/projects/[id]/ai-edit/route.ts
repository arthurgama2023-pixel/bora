// Editor IA — recebe um comando em linguagem natural, o agente gera Operations
// e elas são aplicadas pelo MESMO caminho da UI (validação + snapshot + resync).
// Guarda de escopo: mudanças que tocam quase toda a timeline exigem confirmação.
import { NextResponse } from "next/server";
import { filterValidOps, runEditorAgent } from "@/lib/ai/editor-agent";
import { applyOpsToProject, loadTimelineState } from "@/lib/timeline/store";
import { enforce } from "@/lib/ratelimit";
import { authedOwner } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Cada comando dispara uma chamada de IA (custo). No máx. 30/min por IP.
  const limited = enforce(req, "ai-edit", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  const project = gate.project;
  if (project.status === "processing" || project.status === "rendering") {
    return NextResponse.json({ error: "Aguarde o processamento terminar." }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { command?: string; force?: boolean };
  const command = (body.command ?? "").trim();
  if (!command) return NextResponse.json({ error: "Escreva um comando para o Editor IA." }, { status: 400 });
  if (command.length > 600) return NextResponse.json({ error: "Comando muito longo (máx. 600 caracteres)." }, { status: 400 });

  const state = loadTimelineState(id);
  if (!state) return NextResponse.json({ error: "Timeline ainda não gerada." }, { status: 404 });

  try {
    const agent = await runEditorAgent(id, state.doc, command);

    if (agent.ops.length === 0) {
      return NextResponse.json({
        applied: 0,
        dropped: 0,
        explanation: agent.explanation,
        label: agent.label,
        touched: [],
        notes: agent.notes,
        ...state,
      });
    }

    // Guarda de escopo: IA querendo mexer em quase tudo pede confirmação
    const touchedRatio = agent.touched.length / Math.max(1, state.doc.clips.length);
    if (touchedRatio > 0.8 && state.doc.clips.length > 5 && !body.force) {
      return NextResponse.json(
        {
          needsConfirmation: true,
          explanation: agent.explanation,
          label: agent.label,
          plannedOps: agent.ops.length,
          error: `A IA quer alterar ${agent.touched.length} de ${state.doc.clips.length} clips (${Math.round(touchedRatio * 100)}% da timeline). Confirme para aplicar.`,
        },
        { status: 202 }
      );
    }

    // Resiliência: uma op inválida não derruba a transação da IA inteira
    const { valid, dropped } = filterValidOps(state.doc, agent.ops);
    if (valid.length === 0) {
      return NextResponse.json({
        applied: 0,
        dropped,
        explanation: `${agent.explanation}\n(Nenhuma operação pôde ser aplicada com segurança.)`,
        label: agent.label,
        touched: [],
        notes: agent.notes,
        ...state,
      });
    }

    const newState = applyOpsToProject(id, valid, "ai", `🤖 ${agent.label}`);
    return NextResponse.json({
      applied: valid.length,
      dropped,
      explanation: agent.explanation,
      label: agent.label,
      touched: agent.touched,
      notes: agent.notes,
      ...newState,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    // Erros do provedor de IA vêm às vezes como página HTML ou JSON gigante —
    // nunca mostrar isso ao usuário
    const friendly =
      msg.includes("<!DOCTYPE") || msg.includes("<html")
        ? "O provedor de IA está temporariamente sobrecarregado (limite de requisições). Aguarde alguns segundos e tente de novo."
        : msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")
          ? "Limite de requisições do provedor de IA atingido. Aguarde um instante e tente novamente."
          : msg.slice(0, 200);
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
