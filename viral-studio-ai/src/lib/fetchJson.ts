// fetch com timeout: um request que fica pendente para sempre (worker do Next dev
// que morreu, rede do celular caída, etc.) NÃO pode virar spinner eterno. Após o
// prazo abortamos e sinalizamos como erro recuperável ("Tentar de novo").
export class LoadTimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "LoadTimeoutError";
  }
}

export type LoadResult<T> =
  | { ok: true; data: T }
  // status = campo "status" que a rota inclui no corpo do erro (ex.: "processing")
  | { ok: false; status?: string; error: string; timedOut?: boolean };

/** GET JSON com timeout. Devolve sempre um resultado — nunca fica pendente. */
export async function loadJson<T>(
  url: string,
  { timeoutMs = 15000 }: { timeoutMs?: number } = {}
): Promise<LoadResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new LoadTimeoutError()), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    const json = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (res.ok) return { ok: true, data: json as T };
    // Sessão expirada/ausente → manda para o login (só no cliente).
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
      return { ok: false, status: "401", error: "Faça login para continuar." };
    }
    return {
      ok: false,
      status: (json as { status?: string }).status,
      error:
        (json as { error?: string }).error ??
        `O servidor respondeu com erro (${res.status}).`,
    };
  } catch {
    if (ctrl.signal.aborted) {
      return {
        ok: false,
        timedOut: true,
        error:
          "O servidor demorou demais para responder. Ele pode estar ocupado renderizando outro vídeo — tente de novo.",
      };
    }
    return { ok: false, error: "Sem conexão com o servidor. Verifique a rede e tente de novo." };
  } finally {
    clearTimeout(timer);
  }
}
