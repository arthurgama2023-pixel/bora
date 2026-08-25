"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza a página de Clientes sozinha, em intervalo fixo, para que a contagem
 * das abas (Registrados / Não registrados) e a lista reflitam em (quase) tempo
 * real os contatos que o agente registra pelo WhatsApp — sem o dono precisar
 * recarregar. Usa router.refresh() (re-roda o Server Component, que é
 * force-dynamic). Só roda com a aba visível, para não gastar à toa.
 */
export function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    // Ao voltar o foco para a aba, atualiza na hora (pegou o que chegou enquanto
    // estava em outra aba).
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);
  return null;
}
