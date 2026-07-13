// Guarda de tempo para QUALQUER chamada externa (IA, Whisper, etc.).
// Motivo: o pipeline roda com concorrência baixa (FFmpeg é pesado). Uma única
// requisição de upstream que fica pendente para sempre — provedor de IA travado,
// socket meio-aberto, rede caída — bloquearia a fila de render inteira, para
// TODOS os usuários, indefinidamente. Este helper garante que a promise rejeita
// no prazo mesmo que o SDK ignore o AbortSignal, e ainda assim aborta o sinal
// para cancelar o socket quando o SDK o respeita (melhor esforço).
export class UpstreamTimeoutError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} excedeu o tempo limite de ${Math.round(ms / 1000)}s.`);
    this.name = "UpstreamTimeoutError";
  }
}

export async function withTimeout<T>(
  what: string,
  ms: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new UpstreamTimeoutError(what, ms));
    }, ms);
  });
  try {
    return await Promise.race([run(ctrl.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Timeout padrão para geração de texto/estruturado da IA (Opus com "thinking"
// pode ser lento). Configurável por env sem tocar no código.
export const AI_TIMEOUT_MS = Number(process.env.VIRAL_STUDIO_AI_TIMEOUT_MS) || 180_000;
// Timeout por requisição de transcrição (cada bloco tem no máx. ~10 min de áudio).
export const TRANSCRIBE_TIMEOUT_MS = Number(process.env.VIRAL_STUDIO_TRANSCRIBE_TIMEOUT_MS) || 300_000;
