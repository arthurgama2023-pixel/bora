"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { KEG_CATEGORIES, KEG_CATEGORY_LABELS, type KegCategory } from "@/lib/enums";
import { cn } from "@/lib/utils";

export type KegTypeFormData = {
  id?: string;
  name?: string;
  capacityLiters?: number;
  code?: string;
  category?: string;
  assetValue?: number;
  notes?: string | null;
  active?: boolean;
};

export function KegTypeForm({ initial }: { initial?: KegTypeFormData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<KegCategory>(
    (initial?.category as KegCategory) ?? "BARRIL",
  );

  // Estoque disponível no depósito — "o que tem na casa". Alimenta o estoque
  // (via movimentação de ajuste) ao salvar. Carregado do saldo atual na edição.
  const [stockFull, setStockFull] = useState(0);
  const [stockEmpty, setStockEmpty] = useState(0);
  const [stockLoaded, setStockLoaded] = useState(!initial?.id);

  useEffect(() => {
    if (!initial?.id) return;
    let cancelled = false;
    fetch(`/api/v1/keg-types/${initial.id}/stock`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        if ((initial.category as KegCategory) === "CHOPEIRA") {
          setStockFull(json.data.full + json.data.empty);
          setStockEmpty(0);
        } else {
          setStockFull(json.data.full);
          setStockEmpty(json.data.empty);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStockLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initial?.id, initial?.category]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      capacityLiters: Number(fd.get("capacityLiters")),
      code: String(fd.get("code") ?? "").trim(),
      category,
      assetValue: Number(fd.get("assetValue") || 0),
      notes: String(fd.get("notes") ?? "").trim() || null,
      active: fd.get("active") === "true",
    };
    try {
      const res = await fetch(
        initial?.id ? `/api/v1/keg-types/${initial.id}` : "/api/v1/keg-types",
        {
          method: initial?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Erro ao salvar");
        return;
      }
      // Alimenta o estoque (só se os saldos foram carregados — evita zerar sem querer).
      if (stockLoaded && json.data?.id) {
        const target =
          category === "CHOPEIRA"
            ? { full: stockFull, empty: 0 }
            : { full: stockFull, empty: stockEmpty };
        const stockRes = await fetch(`/api/v1/keg-types/${json.data.id}/stock`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target),
        });
        const stockJson = await stockRes.json();
        if (!stockJson.ok) {
          setError(stockJson.error ?? "Item salvo, mas houve erro ao ajustar o estoque.");
          return;
        }
      }
      router.push("/barris");
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card className="max-w-2xl p-6">
        <div className="mb-6">
          <span className="mb-2 block text-xs font-medium text-muted-foreground">
            Categoria *
          </span>
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            {KEG_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  category === c
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {KEG_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome *">
            <Input
              name="name"
              defaultValue={initial?.name ?? ""}
              placeholder={category === "CHOPEIRA" ? "Chopeira 2 Torneiras" : "Barril 50 Litros"}
              required
            />
          </Field>
          <Field label="Código *">
            <Input
              name="code"
              defaultValue={initial?.code ?? ""}
              placeholder="BRL-50"
              required
            />
          </Field>
          <Field label={category === "CHOPEIRA" ? "Nº de torneiras *" : "Capacidade (litros) *"}>
            <Input
              name="capacityLiters"
              type="number"
              min={1}
              defaultValue={initial?.capacityLiters ?? ""}
              required
            />
          </Field>
          <Field label="Valor patrimonial (R$)">
            <Input
              name="assetValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={initial?.assetValue ?? 0}
            />
          </Field>
          <Field label="Status">
            <Select name="active" defaultValue={String(initial?.active ?? true)}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="notes" defaultValue={initial?.notes ?? ""} />
          </Field>
        </div>

        {/* Estoque no depósito — o que a casa tem deste item */}
        <div className="mt-6 border-t border-border pt-6">
          <h2 className="text-sm font-semibold">Estoque no depósito</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {category === "CHOPEIRA"
              ? "Quantas unidades você tem disponíveis na casa. Alimenta o estoque automaticamente."
              : "Quantos você tem na casa agora, cheios e vazios. Alimenta o estoque automaticamente (via ajuste, mantendo o histórico)."}
          </p>
          {!stockLoaded ? (
            <p className="mt-3 text-sm text-muted-foreground">Carregando saldo atual…</p>
          ) : category === "CHOPEIRA" ? (
            <div className="mt-3 max-w-xs">
              <Field label="Unidades disponíveis">
                <Input
                  type="number"
                  min={0}
                  value={stockFull}
                  onChange={(e) => setStockFull(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
            </div>
          ) : (
            <div className="mt-3 grid max-w-md gap-4 sm:grid-cols-2">
              <Field label="Cheios">
                <Input
                  type="number"
                  min={0}
                  value={stockFull}
                  onChange={(e) => setStockFull(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
              <Field label="Vazios">
                <Input
                  type="number"
                  min={0}
                  value={stockEmpty}
                  onChange={(e) => setStockEmpty(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando…" : initial?.id ? "Salvar alterações" : "Cadastrar tipo"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
