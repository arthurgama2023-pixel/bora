"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { ROLES, ROLE_LABELS } from "@/lib/enums";

type UserData = {
  id?: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

function UserModal({
  user,
  isSelf,
  onClose,
}: {
  user?: UserData;
  isSelf?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      role: String(fd.get("role") ?? "STOCKIST"),
      active: fd.get("active") === "true",
    };
    const password = String(fd.get("password") ?? "");
    if (password || !user?.id) payload.password = password;

    try {
      const res = await fetch(
        user?.id ? `/api/v1/users/${user.id}` : "/api/v1/users",
        {
          method: user?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Erro ao salvar");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">
            {user?.id ? `Editar — ${user.name}` : "Novo usuário"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Nome *">
            <Input name="name" defaultValue={user?.name ?? ""} required />
          </Field>
          <Field label="E-mail *">
            <Input name="email" type="email" defaultValue={user?.email ?? ""} required />
          </Field>
          <Field label={user?.id ? "Nova senha (deixe vazio para manter)" : "Senha *"}>
            <Input
              name="password"
              type="password"
              minLength={6}
              required={!user?.id}
              placeholder="mínimo 6 caracteres"
            />
          </Field>
          <Field label="Papel">
            <Select name="role" defaultValue={user?.role ?? "STOCKIST"} disabled={isSelf}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              name="active"
              defaultValue={String(user?.active ?? true)}
              disabled={isSelf}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
          </Field>
        </div>
        {error && (
          <p className="mt-4 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

export function UserCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo usuário
      </Button>
      {open && <UserModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function UserActions({
  user,
  isSelf,
}: {
  user: UserData & { id: string };
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <UserModal user={user} isSelf={isSelf} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
