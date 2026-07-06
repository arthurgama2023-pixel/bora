"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

export type KegTypeFormData = {
  id?: string;
  name?: string;
  capacityLiters?: number;
  code?: string;
  assetValue?: number;
  notes?: string | null;
  active?: boolean;
};

export function KegTypeForm({ initial }: { initial?: KegTypeFormData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      capacityLiters: Number(fd.get("capacityLiters")),
      code: String(fd.get("code") ?? "").trim(),
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
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome *">
            <Input
              name="name"
              defaultValue={initial?.name ?? ""}
              placeholder="Barril 50 Litros"
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
          <Field label="Capacidade (litros) *">
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
