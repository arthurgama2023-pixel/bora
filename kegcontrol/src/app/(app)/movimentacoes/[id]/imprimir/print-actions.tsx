"use client";

import { Printer, Wifi, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

// O navegador não consegue, por segurança, "conectar" sozinho a uma impressora
// Wi-Fi — quem faz isso é o sistema operacional. Ao mandar imprimir, abre a
// janela do sistema onde as impressoras no mesmo Wi-Fi aparecem (AirPrint no
// iPhone/iPad, Mopria no Android, impressora de rede no computador). Este fluxo
// guia o usuário até essa janela com o enquadramento de "conectar e imprimir".
export function PrintActions() {
  const [open, setOpen] = useState(false);

  function connectAndPrint() {
    setOpen(false);
    // pequeno atraso para o diálogo sumir antes da janela de impressão
    setTimeout(() => window.print(), 150);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4" /> Imprimir folha
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand-strong">
                  <Wifi className="h-5 w-5" />
                </span>
                <h2 className="text-base font-semibold">Conectar impressora e imprimir</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Ao continuar, abre a janela de impressão do aparelho. É nela que você
              escolhe a impressora:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-brand-strong">•</span>
                <span>
                  <strong className="text-foreground">Mesma rede Wi-Fi:</strong> impressoras
                  ligadas no mesmo Wi-Fi deste aparelho aparecem sozinhas na lista
                  (AirPrint no iPhone/iPad, Mopria no Android, ou impressora de rede no
                  computador).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-strong">•</span>
                <span>
                  Se não aparecer, confira se a impressora está <strong className="text-foreground">ligada</strong> e no{" "}
                  <strong className="text-foreground">mesmo Wi-Fi</strong> — depois toque em
                  &quot;atualizar&quot; na janela de impressão.
                </span>
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={connectAndPrint}>
                <Printer className="h-4 w-4" /> Conectar e imprimir
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
