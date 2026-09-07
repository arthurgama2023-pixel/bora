// ─── Ajuste do agente pelo WhatsApp (para leigo) ────────────────────────────
//
// O dono da distribuidora (leigo) ajusta o agente escrevendo no WhatsApp em
// português normal — sem decorar palavra-chave. Em vez de aplicar direto, o
// agente entra num "modo ajuste", mostra o que vai mudar e pede um "sim" antes
// de valer. Fluxo:
//   • gatilho ("ajustar", "configurar", "ajuste: ...") liga o modo;
//   • no modo, cada mensagem vira uma instrução → o agente gera a PRÉVIA e
//     pergunta "aplico?";
//   • "sim" aplica; "não" descarta; "desfazer" reverte o último; "sair" desliga.
// Fora do modo, o número segue sendo atendido como cliente (testa o agente).
//
// Este arquivo tem a MÁQUINA DE ESTADOS PURA (decideTrainerAction) — testável
// sem banco. A orquestração com Prisma/IA (gera a prévia, aplica, desfaz,
// liga/desliga o modo) fica em agent.ts: handleTrainerMessage.

export type TrainerMode = "idle" | "adjusting";

export type TrainerAction =
  | { kind: "enter"; instruction?: string } // liga o modo (opcionalmente já com um ajuste)
  | { kind: "exit" } // desliga o modo
  | { kind: "undo" } // desfaz o último ajuste salvo
  | { kind: "confirm" } // aplica a prévia pendente
  | { kind: "cancel" } // descarta a prévia pendente
  | { kind: "instruct"; instruction: string } // nova instrução de ajuste
  | { kind: "help" } // pede ajuda de como usar
  | { kind: "ignore" } // texto vazio
  | { kind: "passthrough" }; // não é ajuste — trata como mensagem de cliente

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Gatilhos que LIGAM o modo ajuste (quando o número está ocioso). O ":" é
// opcional e o que vem depois é tratado como um primeiro ajuste.
const ENTER_RE = /^(ajustes?|ajustar|configurar|config|treino|treinar|modo\s+ajuste)\b\s*:?\s*([\s\S]*)$/i;

const EXIT_WORDS = ["sair", "pronto", "fechar", "terminar", "encerrar", "parar", "fim"];
const UNDO_WORDS = ["desfazer", "desfaz", "desfaca", "voltar", "volta", "undo", "reverter"];
const YES_WORDS = ["sim", "pode", "pode aplicar", "aplica", "aplicar", "confirmar", "confirma", "isso", "ok", "beleza", "manda", "vai", "aplique", "s"];
const NO_WORDS = ["nao", "cancela", "cancelar", "deixa", "para", "negativo", "melhor nao", "espera", "n"];
const HELP_WORDS = ["ajuda", "como funciona", "como usar", "help", "socorro"];

function isOneOf(n: string, words: string[]): boolean {
  return words.includes(n);
}

// Decide o que fazer com uma mensagem de um número TREINADOR, dado o estado
// atual do modo ajuste. Pura — não toca banco nem IA.
export function decideTrainerAction(
  text: string,
  state: { mode: TrainerMode; hasPending: boolean },
): TrainerAction {
  const n = normalize(text);
  if (!n) return { kind: "ignore" };

  if (state.mode === "adjusting") {
    if (isOneOf(n, EXIT_WORDS)) return { kind: "exit" };
    if (isOneOf(n, UNDO_WORDS)) return { kind: "undo" };
    if (isOneOf(n, HELP_WORDS)) return { kind: "help" };
    if (state.hasPending) {
      if (isOneOf(n, YES_WORDS)) return { kind: "confirm" };
      if (isOneOf(n, NO_WORDS)) return { kind: "cancel" };
      // qualquer outra coisa com prévia pendente = nova instrução (substitui).
    }
    return { kind: "instruct", instruction: text.trim() };
  }

  // Ocioso: só liga o modo com um gatilho explícito. O resto é conversa de
  // cliente (o treinador também compra/testa pelo mesmo número).
  const m = text.trim().match(ENTER_RE);
  if (m) {
    const instruction = (m[2] ?? "").trim();
    // Só conta como "já veio um ajuste" se sobrar conteúdo de verdade (letra ou
    // número). "ajuste", "ajuste!" ou "ajuste:" sozinhos só LIGAM o modo.
    return /[\p{L}\p{N}]/u.test(instruction)
      ? { kind: "enter", instruction }
      : { kind: "enter" };
  }
  return { kind: "passthrough" };
}
