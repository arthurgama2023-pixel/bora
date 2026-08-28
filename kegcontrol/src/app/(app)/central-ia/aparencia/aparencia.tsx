"use client";

import { Check, ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";

// Reduz a imagem no NAVEGADOR antes de subir (o Render não tem ferramenta de
// resize). Máx. 1080px de largura, JPEG — mantém a tabela nítida sem estourar o
// banco. Devolve um data URI.
function downscale(file: File, maxW = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Seu navegador não suportou o preparo da imagem."));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não consegui ler essa imagem. Tente outra (PNG ou JPEG)."));
    };
    img.src = url;
  });
}

// Prévia com uma localidade de exemplo (preços reais dessa zona).
const PREVIEW_QS = "cidade=Baixada+Fluminense&bairro=Xer%C3%A9m&preview=1";

export function Aparencia({
  initialOverlay,
  initialHasActive,
  initialHasDraft,
}: {
  initialOverlay: number;
  initialHasActive: boolean;
  initialHasDraft: boolean;
}) {
  const [overlay, setOverlay] = useState(initialOverlay);
  const [hasActive, setHasActive] = useState(initialHasActive);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [cb, setCb] = useState(0); // cache-bust da prévia
  const fileRef = useRef<HTMLInputElement>(null);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpPreview = () => setCb((n) => n + 1);
  const previewSrc = `/api/tabela-precos?${PREVIEW_QS}&cb=${cb}`;

  async function putAppearance(body: Record<string, unknown>) {
    const res = await fetch("/api/v1/table-appearance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Erro ao salvar");
    return json.data as { hasActive: boolean; hasDraft: boolean; overlay: number };
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const image = await downscale(file);
      const st = await putAppearance({ action: "draft", image, overlay });
      setHasDraft(st.hasDraft);
      bumpPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar a imagem");
    } finally {
      setBusy(false);
    }
  }

  // Slider de escurecimento — atualiza a prévia com debounce.
  function onOverlay(v: number) {
    setOverlay(v);
    setSaved(false);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(async () => {
      try {
        await putAppearance({ action: "draft", overlay: v });
        bumpPreview();
      } catch {
        // silencioso — o próximo ajuste tenta de novo
      }
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, []);

  async function salvar() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const st = await putAppearance({ action: "commit" });
      setHasActive(st.hasActive);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function remover() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const st = await putAppearance({ action: "reset" });
      setHasActive(st.hasActive);
      setHasDraft(st.hasDraft);
      setOverlay(st.overlay);
      bumpPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Controles ─────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="font-semibold">Imagem de fundo</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A imagem entra atrás dos preços. O escurecimento mantém os números legíveis.
          </p>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {hasDraft || hasActive ? "Trocar imagem" : "Enviar imagem"}
        </Button>

        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <label className="font-medium">Escurecimento</label>
            <span className="tabular-nums text-muted-foreground">{overlay}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={85}
            step={5}
            value={overlay}
            onChange={(e) => onOverlay(Number(e.target.value))}
            className="w-full accent-[var(--brand,#e7b424)]"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Mais escuro = preços mais legíveis sobre imagens claras.
          </p>
        </div>

        {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button onClick={salvar} disabled={busy || !hasDraft}>
            <Check className="h-4 w-4" /> Salvar (usar no WhatsApp)
          </Button>
          <Button variant="ghost" onClick={remover} disabled={busy || (!hasActive && !hasDraft)}>
            <Trash2 className="h-4 w-4" /> Remover
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="h-4 w-4" /> Salvo — o agente já usa esse fundo
            </span>
          )}
        </div>
        {hasActive && (
          <p className="text-xs text-muted-foreground">
            Já existe um fundo salvo em uso. Enviar outra imagem só troca a prévia — clique em Salvar para valer.
          </p>
        )}
      </Card>

      {/* ── Prévia ────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Prévia</h2>
          <button
            type="button"
            onClick={bumpPreview}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Como fica a tabela no WhatsApp (preços de exemplo: Xerém · Baixada Fluminense).
        </p>
        <div className="flex justify-center rounded-xl border border-border bg-muted/30 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={cb}
            src={previewSrc}
            alt="Prévia da tabela de preços"
            className="w-full max-w-[320px] rounded-lg"
          />
        </div>
      </Card>
    </div>
  );
}
