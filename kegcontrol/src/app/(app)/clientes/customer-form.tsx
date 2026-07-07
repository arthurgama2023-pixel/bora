"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
} from "@/lib/enums";
import { cn } from "@/lib/utils";

export type CustomerFormData = {
  id?: string;
  name?: string;
  companyName?: string | null;
  type?: string;
  document?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  contactName?: string | null;
  notes?: string | null;
  status?: string;
};

type PriceRow = {
  kegTypeId: string;
  name: string;
  code: string;
  capacityLiters: number;
  price: number;
  quantity: number;
};

type StockRow = {
  kegTypeId: string;
  name: string;
  code: string;
  capacityLiters: number;
  entrega: number; // cheios em poder do cliente
  retirada: number; // vazios a retirar do cliente
};

export function CustomerForm({
  initial,
  canDelete = false,
}: {
  initial?: CustomerFormData;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<CustomerType>(
    (initial?.type as CustomerType) ?? "COMERCIO",
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Preços por tipo de barril — a lista vem pronta (todos os tipos ativos da
  // empresa, pré-selecionados) para só preencher o valor que este cliente paga.
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoaded, setPricesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (initial?.id) {
        const res = await fetch(`/api/v1/customers/${initial.id}/prices`);
        const json = await res.json();
        if (!cancelled && json.ok) setPrices(json.data);
      } else {
        const res = await fetch("/api/v1/keg-types");
        const json = await res.json();
        if (!cancelled && json.ok) {
          setPrices(
            (json.data as { id: string; name: string; code: string; capacityLiters: number; active: boolean }[])
              .filter((k) => k.active)
              .map((k) => ({
                kegTypeId: k.id,
                name: k.name,
                code: k.code,
                capacityLiters: k.capacityLiters,
                price: 0,
                quantity: 0,
              })),
          );
        }
      }
      if (!cancelled) setPricesLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [initial?.id]);

  function updatePrice(kegTypeId: string, value: string) {
    const price = value === "" ? 0 : Number(value);
    setPrices((prev) => prev.map((p) => (p.kegTypeId === kegTypeId ? { ...p, price } : p)));
  }

  function updatePriceQty(kegTypeId: string, value: string) {
    const quantity = value === "" ? 0 : Math.max(0, Math.floor(Number(value) || 0));
    setPrices((prev) => prev.map((p) => (p.kegTypeId === kegTypeId ? { ...p, quantity } : p)));
  }

  async function savePrices(customerId: string) {
    await fetch(`/api/v1/customers/${customerId}/prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prices: prices.map((p) => ({
          kegTypeId: p.kegTypeId,
          price: p.price,
          quantity: p.quantity,
        })),
      }),
    });
  }

  // Estoque com o cliente (Entrega/Retirada/Saldo) — mesma ideia dos preços:
  // lista pronta, pré-selecionada, sem precisar "adicionar" nada.
  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockLoaded, setStockLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (initial?.id) {
        const res = await fetch(`/api/v1/customers/${initial.id}/stock`);
        const json = await res.json();
        if (!cancelled && json.ok) setStock(json.data);
      } else {
        const res = await fetch("/api/v1/keg-types");
        const json = await res.json();
        if (!cancelled && json.ok) {
          setStock(
            (json.data as { id: string; name: string; code: string; capacityLiters: number; active: boolean }[])
              .filter((k) => k.active)
              .map((k) => ({
                kegTypeId: k.id,
                name: k.name,
                code: k.code,
                capacityLiters: k.capacityLiters,
                entrega: 0,
                retirada: 0,
              })),
          );
        }
      }
      if (!cancelled) setStockLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [initial?.id]);

  function updateStock(kegTypeId: string, field: "entrega" | "retirada", value: string) {
    const n = value === "" ? 0 : Math.max(0, Number(value) || 0);
    setStock((prev) => prev.map((s) => (s.kegTypeId === kegTypeId ? { ...s, [field]: n } : s)));
  }

  async function saveStock(customerId: string) {
    if (!stockLoaded) return;
    await fetch(`/api/v1/customers/${customerId}/stock`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: stock.map((s) => ({
          kegTypeId: s.kegTypeId,
          entrega: s.entrega,
          retirada: s.retirada,
        })),
      }),
    });
  }

  async function handleDelete() {
    if (!initial?.id) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/v1/customers/${initial.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        setDeleteError(json.error ?? "Erro ao excluir");
        setDeleting(false);
        return;
      }
      router.push("/clientes");
      router.refresh();
    } catch {
      setDeleteError("Erro de conexão");
      setDeleting(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(
      [...fd.entries()].map(([k, v]) => [k, String(v).trim() || null]),
    );
    payload.status = payload.status ?? "ACTIVE";
    payload.type = type;
    if (!payload.name) {
      setError("Nome é obrigatório");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        initial?.id ? `/api/v1/customers/${initial.id}` : "/api/v1/customers",
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
      await savePrices(json.data.id);
      await saveStock(json.data.id);
      router.push(`/clientes/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card className="p-6">
        <div className="mb-6">
          <span className="mb-2 block text-xs font-medium text-muted-foreground">
            Tipo de cliente *
          </span>
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            {CUSTOMER_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  type === t
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {CUSTOMER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome *">
            <Input name="name" defaultValue={initial?.name ?? ""} required />
          </Field>
          <Field label="Empresa">
            <Input name="companyName" defaultValue={initial?.companyName ?? ""} />
          </Field>
          <Field label="CPF/CNPJ">
            <Input
              name="document"
              defaultValue={initial?.document ?? ""}
              placeholder="somente números"
            />
          </Field>
          <Field label="Telefone">
            <Input name="phone" defaultValue={initial?.phone ?? ""} />
          </Field>
          <Field label="WhatsApp">
            <Input name="whatsapp" defaultValue={initial?.whatsapp ?? ""} />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" defaultValue={initial?.email ?? ""} />
          </Field>
          <Field label="Endereço" className="lg:col-span-2">
            <Input name="address" defaultValue={initial?.address ?? ""} />
          </Field>
          <Field label="Bairro">
            <Input name="neighborhood" defaultValue={initial?.neighborhood ?? ""} />
          </Field>
          <Field label="Cidade">
            <Input name="city" defaultValue={initial?.city ?? ""} />
          </Field>
          <Field label="UF">
            <Input name="state" maxLength={2} defaultValue={initial?.state ?? ""} />
          </Field>
          <Field label="Responsável">
            <Input name="contactName" defaultValue={initial?.contactName ?? ""} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={initial?.status ?? "ACTIVE"}>
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CUSTOMER_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observações" className="md:col-span-2 lg:col-span-3">
            <Textarea name="notes" defaultValue={initial?.notes ?? ""} />
          </Field>
        </div>
        {error && (
          <p className="mt-4 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando…" : initial?.id ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>

          {initial?.id && canDelete && !confirmingDelete && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir cliente
            </button>
          )}
        </div>

        {initial?.id && canDelete && confirmingDelete && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
            <p className="text-sm font-medium text-danger">
              Excluir este cliente permanentemente?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Essa ação não pode ser desfeita. Só é possível excluir clientes sem
              movimentações ou barris em poder deles — caso contrário, marque como
              Bloqueado ou Inativo.
            </p>
            {deleteError && (
              <p className="mt-2 rounded-md bg-danger/15 px-3 py-2 text-xs text-danger">
                {deleteError}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Excluindo…" : "Sim, excluir"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deleting}
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeleteError("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="text-sm font-semibold">Preços por tipo de barril</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Preço que este cliente paga e a quantidade acordada de cada tipo.
          Deixe em branco os tipos que não se aplicam a ele.
        </p>
        {!pricesLoaded ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : prices.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum tipo de barril cadastrado ainda.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {prices.map((p) => (
              <div
                key={p.kegTypeId}
                className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
              >
                <span className="block text-xs font-medium">
                  {p.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({p.code} · {p.capacityLiters}L)
                  </span>
                </span>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className="mb-1 block text-[11px] text-muted-foreground">Preço</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        R$
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0,00"
                        className="pl-9"
                        value={p.price > 0 ? p.price : ""}
                        onChange={(e) => updatePrice(p.kegTypeId, e.target.value)}
                      />
                    </div>
                  </label>
                  <label className="w-24">
                    <span className="mb-1 block text-[11px] text-muted-foreground">Qtd</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={p.quantity > 0 ? p.quantity : ""}
                      onChange={(e) => updatePriceQty(p.kegTypeId, e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="text-sm font-semibold">Estoque com o cliente</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Entrega = cheios em poder do cliente · Retirada = vazios a retirar dele · Saldo =
          total. Preencha o que ele já tem com ele hoje.
        </p>
        {!stockLoaded ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : stock.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum tipo de barril cadastrado ainda.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {stock.map((s) => (
              <div
                key={s.kegTypeId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                <span className="min-w-40 text-sm font-medium">
                  {s.name}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({s.code} · {s.capacityLiters}L)
                  </span>
                </span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Entrega
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={s.entrega > 0 ? s.entrega : ""}
                    placeholder="0"
                    onChange={(e) => updateStock(s.kegTypeId, "entrega", e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Retirada
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={s.retirada > 0 ? s.retirada : ""}
                    placeholder="0"
                    onChange={(e) => updateStock(s.kegTypeId, "retirada", e.target.value)}
                  />
                </label>
                <span className="ml-auto text-sm">
                  <span className="text-xs text-muted-foreground">Saldo </span>
                  <span className="font-bold text-brand-strong">
                    {s.entrega + s.retirada}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </form>
  );
}
