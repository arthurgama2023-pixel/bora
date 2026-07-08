"use client";

import { Plus, Trash2, X } from "lucide-react";
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
  openBalance?: number;
  status?: string;
};

type KegTypeOption = {
  kegTypeId: string;
  name: string;
  code: string;
  capacityLiters: number;
};

// Item combinado com o cliente: preço + estoque (Entrega=cheios, Retirada=vazios)
// numa linha só. Só existem linhas para itens que o usuário "adicionou" — nada
// aparece pré-populado, ao contrário do comportamento antigo.
type ClientItemRow = KegTypeOption & {
  price: number;
  entrega: number;
  retirada: number;
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

  // Itens combinados com o cliente: preço + estoque (Entrega/Retirada) numa
  // linha só. Nada aparece pré-populado — o usuário clica num chip pra
  // adicionar só os tipos que esse cliente realmente tem/combinou.
  const [allKegTypes, setAllKegTypes] = useState<KegTypeOption[]>([]);
  const [items, setItems] = useState<ClientItemRow[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const typesRes = await fetch("/api/v1/keg-types");
      const typesJson = await typesRes.json();
      const types: KegTypeOption[] = typesJson.ok
        ? (typesJson.data as { id: string; name: string; code: string; capacityLiters: number; active: boolean }[])
            .filter((k) => k.active)
            .map((k) => ({
              kegTypeId: k.id,
              name: k.name,
              code: k.code,
              capacityLiters: k.capacityLiters,
            }))
        : [];
      if (cancelled) return;
      setAllKegTypes(types);

      if (initial?.id) {
        const [pricesRes, stockRes] = await Promise.all([
          fetch(`/api/v1/customers/${initial.id}/prices`),
          fetch(`/api/v1/customers/${initial.id}/stock`),
        ]);
        const pricesJson = await pricesRes.json();
        const stockJson = await stockRes.json();
        const priceByType = new Map(
          (pricesJson.ok ? pricesJson.data : []).map((p: { kegTypeId: string; price: number }) => [
            p.kegTypeId,
            p.price,
          ]),
        );
        const stockByType = new Map(
          (stockJson.ok ? stockJson.data : []).map(
            (s: { kegTypeId: string; entrega: number; retirada: number }) => [
              s.kegTypeId,
              s,
            ],
          ),
        );
        if (!cancelled) {
          setItems(
            types
              .map((t) => {
                const price = Number(priceByType.get(t.kegTypeId) ?? 0);
                const s = stockByType.get(t.kegTypeId) as
                  | { entrega: number; retirada: number }
                  | undefined;
                return {
                  ...t,
                  price,
                  entrega: s?.entrega ?? 0,
                  retirada: s?.retirada ?? 0,
                };
              })
              .filter((r) => r.price > 0 || r.entrega > 0 || r.retirada > 0),
          );
        }
      }
      if (!cancelled) setItemsLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [initial?.id]);

  const availableToAdd = allKegTypes.filter(
    (t) => !items.some((i) => i.kegTypeId === t.kegTypeId),
  );

  function addItem(kegTypeId: string) {
    const t = allKegTypes.find((k) => k.kegTypeId === kegTypeId);
    if (!t) return;
    setItems((prev) => [...prev, { ...t, price: 0, entrega: 0, retirada: 0 }]);
  }

  function removeItem(kegTypeId: string) {
    setItems((prev) => prev.filter((i) => i.kegTypeId !== kegTypeId));
  }

  function updateItem(
    kegTypeId: string,
    field: "price" | "entrega" | "retirada",
    value: string,
  ) {
    const n = value === "" ? 0 : Math.max(0, Number(value) || 0);
    setItems((prev) => prev.map((i) => (i.kegTypeId === kegTypeId ? { ...i, [field]: n } : i)));
  }

  // Salva cobrindo TODOS os tipos ativos (não só os visíveis) — assim, remover
  // um item da tela e salvar realmente zera o que existia antes no servidor.
  async function saveItems(customerId: string) {
    const byType = new Map(items.map((i) => [i.kegTypeId, i]));
    const prices = allKegTypes.map((t) => {
      const row = byType.get(t.kegTypeId);
      return {
        kegTypeId: t.kegTypeId,
        price: row?.price ?? 0,
        quantity: row ? row.entrega + row.retirada : 0,
      };
    });
    const entries = allKegTypes.map((t) => {
      const row = byType.get(t.kegTypeId);
      return {
        kegTypeId: t.kegTypeId,
        entrega: row?.entrega ?? 0,
        retirada: row?.retirada ?? 0,
      };
    });
    await Promise.all([
      fetch(`/api/v1/customers/${customerId}/prices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices }),
      }),
      fetch(`/api/v1/customers/${customerId}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      }),
    ]);
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
    const payload: Record<string, unknown> = Object.fromEntries(
      [...fd.entries()]
        .filter(([k]) => k !== "openBalance")
        .map(([k, v]) => [k, String(v).trim() || null]),
    );
    payload.status = payload.status ?? "ACTIVE";
    payload.type = type;
    payload.openBalance = Number(fd.get("openBalance") || 0);
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
      await saveItems(json.data.id);
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
          <Field label="Valor em aberto (R$)">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <Input
                name="openBalance"
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
                className="pl-9"
                defaultValue={initial?.openBalance || ""}
              />
            </div>
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
              Essa ação não pode ser desfeita. O cliente é excluído mesmo que tenha
              barris em poder dele, dívida ou movimentações — os barris deixam de ser
              rastreados e as movimentações antigas ficam sem cliente vinculado (mas
              continuam no extrato geral). Considere Bloquear ou Inativar se quiser
              manter o rastro.
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
        <h2 className="text-sm font-semibold">Itens do cliente</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Adicione só os tipos de barril que este cliente realmente tem ou combinou —
          preço, Entrega (cheios), Retirada (vazios) e Saldo, tudo numa linha.
        </p>

        {!itemsLoaded ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            {availableToAdd.length > 0 && (
              <div className="mt-4">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Adicionar item
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableToAdd.map((t) => (
                    <button
                      key={t.kegTypeId}
                      type="button"
                      onClick={() => addItem(t.kegTypeId)}
                      className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-strong transition-colors hover:bg-brand/20"
                    >
                      <Plus className="h-3 w-3" />
                      {t.name} <span className="opacity-70">({t.code})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhum item adicionado ainda — clique num tipo acima.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {items.map((i) => (
                  <div
                    key={i.kegTypeId}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <span className="min-w-36 text-sm font-medium">
                      {i.name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({i.code} · {i.capacityLiters}L)
                      </span>
                    </span>

                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Preço
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0,00"
                          className="w-24 pl-7"
                          value={i.price > 0 ? i.price : ""}
                          onChange={(e) => updateItem(i.kegTypeId, "price", e.target.value)}
                        />
                      </div>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Entrega
                      <Input
                        type="number"
                        min={0}
                        className="w-20"
                        placeholder="0"
                        value={i.entrega > 0 ? i.entrega : ""}
                        onChange={(e) => updateItem(i.kegTypeId, "entrega", e.target.value)}
                      />
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Retirada
                      <Input
                        type="number"
                        min={0}
                        className="w-20"
                        placeholder="0"
                        value={i.retirada > 0 ? i.retirada : ""}
                        onChange={(e) => updateItem(i.kegTypeId, "retirada", e.target.value)}
                      />
                    </label>

                    <span className="text-sm">
                      <span className="text-xs text-muted-foreground">Saldo </span>
                      <span className="font-bold text-brand-strong">
                        {i.entrega + i.retirada}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => removeItem(i.kegTypeId)}
                      title="Remover item"
                      className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </form>
  );
}
