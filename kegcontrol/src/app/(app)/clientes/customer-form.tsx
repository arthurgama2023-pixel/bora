"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  city?: string | null;
  state?: string | null;
  contactName?: string | null;
  notes?: string | null;
  status?: string;
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
    </form>
  );
}
