// Agrupamento de RAJADA de mensagens do WhatsApp.
//
// Problema: no WhatsApp o cliente digita em pedaços ("quero chopp" / "belco
// 50" / "2 barris") — 3 mensagens em segundos. Cada uma dispara um webhook e
// uma chamada separada ao agente; como o Gemini leva alguns segundos, a 2ª
// mensagem entra antes de a resposta da 1ª ficar salva, e o agente REPETE a
// pergunta / responde duas vezes. No chat do painel isso não acontece porque
// vem um turno completo por vez.
//
// Solução: juntar as mensagens que chegam em até `windowMs` numa só e chamar
// o processamento UMA vez, com tudo junto. Estado em memória — o kegcontrol
// roda como um processo Node único no Render (web service, sem sleep), então
// o buffer por telefone persiste entre os webhooks. Se o processo reiniciar no
// meio de uma rajada (raro), perde-se o buffer daquele instante — aceitável.
//
// Puro o suficiente pra testar: usa setTimeout/clearTimeout (cobertos por fake
// timers no vitest) e expõe joinBurst (pura) + _resetBursts (só pra teste).

type FlushFn = (combined: string) => void | Promise<void>;

type Entry = {
  parts: string[];
  timer: ReturnType<typeof setTimeout>;
  flush: FlushFn;
};

const buffers = new Map<string, Entry>();

// Janela de silêncio: só processa depois de `windowMs` sem chegar mensagem
// nova daquele telefone. 2,5s agrupa a digitação em pedaços sem deixar a
// resposta lenta demais.
export const DEFAULT_WINDOW_MS = 2500;

// Junta os pedaços numa mensagem só (uma por linha), aparando espaços e
// descartando linhas vazias. Pura e testável.
export function joinBurst(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join("\n");
}

// Enfileira uma mensagem para o telefone `key`. Enquanto chegarem novas dentro
// da janela, reinicia o timer (acumulando). Quando passar `windowMs` sem nova,
// chama `flush` UMA vez com todas as partes juntas. O flush mais recente vence
// (mantém o closure com o estado mais novo, se relevante).
export function enqueueBurst(
  key: string,
  text: string,
  flush: FlushFn,
  windowMs: number = DEFAULT_WINDOW_MS,
): void {
  const existing = buffers.get(key);
  if (existing) {
    existing.parts.push(text);
    existing.flush = flush;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushBurst(key), windowMs);
    return;
  }
  buffers.set(key, {
    parts: [text],
    flush,
    timer: setTimeout(() => flushBurst(key), windowMs),
  });
}

function flushBurst(key: string): void {
  const entry = buffers.get(key);
  if (!entry) return;
  buffers.delete(key);
  const combined = joinBurst(entry.parts);
  if (!combined) return;
  // Chama o flush SÍNCRONO ao timer (o trabalho assíncrono dentro dele segue
  // por conta própria). Nunca deixa uma falha derrubar o timer/loop.
  try {
    const r = entry.flush(combined);
    if (r && typeof (r as Promise<void>).catch === "function") {
      (r as Promise<void>).catch(() => {});
    }
  } catch {
    // engolido de propósito — best-effort
  }
}

// Só para testes: zera todo o estado pendente.
export function _resetBursts(): void {
  for (const e of buffers.values()) clearTimeout(e.timer);
  buffers.clear();
}
