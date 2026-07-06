"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import {
  CONDITION_LABELS,
  LOCATION_LABELS,
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  type Condition,
  type Location,
  type MovementType,
} from "@/lib/enums";

type KegTypeOption = { id: string; name: string; code: string };
type CustomerOption = { id: string; name: string; status: string };

type Row = {
  kegTypeId: string;
  quantity: number;
  condition: Condition; // condição na origem
  toCondition: Condition | ""; // condição no destino ("" = igual)
  fromLocation: Location;
  toLocation: Location;
  swapDirection: "OUT" | "IN"; // usado apenas na troca
};

const TYPE_HELP: Record<MovementType, string> = {
  DELIVERY: "Barris cheios saem do depósito para o cliente.",
  PICKUP: "Barris voltam do cliente para o depósito (informe como estavam no saldo do cliente).",
  SWAP: "Entrega e retirada na mesma visita — adicione itens nas duas direções.",
  PURCHASE: "Aquisição de barris novos — aumenta o patrimônio.",
  SALE: "Venda de barris — reduz o patrimônio.",
  ADJUSTMENT: "Ajuste livre de inventário, envase (vazio→cheio) ou correção de erro.",
  LOSS: "Registra extravio — o barril sai do saldo ativo mas fica rastreado.",
  MAINTENANCE: "Envio ou retorno de barris da manutenção.",
};

function defaultRow(type: MovementType, direction: "OUT" | "IN" = "OUT"): Row {
  const base = {
    kegTypeId: "",
    quantity: 1,
    toCondition: "" as const,
    swapDirection: direction,
  };
  switch (type) {
    case "DELIVERY":
      return { ...base, condition: "FULL", fromLocation: "WAREHOUSE", toLocation: "CUSTOMER" };
    case "PICKUP":
      return { ...base, condition: "FULL", toCondition: "EMPTY", fromLocation: "CUSTOMER", toLocation: "WAREHOUSE" };
    case "SWAP":
      return direction === "OUT"
        ? { ...base, condition: "FULL", fromLocation: "WAREHOUSE", toLocation: "CUSTOMER" }
        : { ...base, condition: "FULL", toCondition: "EMPTY", fromLocation: "CUSTOMER", toLocation: "WAREHOUSE" };
    case "PURCHASE":
      return { ...base, condition: "EMPTY", fromLocation: "EXTERNAL", toLocation: "WAREHOUSE" };
    case "SALE":
      return { ...base, condition: "EMPTY", fromLocation: "WAREHOUSE", toLocation: "EXTERNAL" };
    case "LOSS":
      return { ...base, condition: "EMPTY", fromLocation: "WAREHOUSE", toLocation: "LOST" };
    case "MAINTENANCE":
      return { ...base, condition: "EMPTY", fromLocation: "WAREHOUSE", toLocation: "MAINTENANCE" };
    case "ADJUSTMENT":
      return { ...base, condition: "EMPTY", fromLocation: "WAREHOUSE", toLocation: "WAREHOUSE", toCondition: "FULL" };
  }
}

export function MovementForm({
  kegTypes,
  customers,
  correctsId,
}: {
  kegTypes: KegTypeOption[];
  customers: CustomerOption[];
  correctsId?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<MovementType>(correctsId ? "ADJUSTMENT" : "DELIVERY");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([defaultRow(correctsId ? "ADJUSTMENT" : "DELIVERY")]);
  const [maintenanceDirection, setMaintenanceDirection] = useState<"IN" | "OUT">("OUT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requiresCustomer = ["DELIVERY", "PICKUP", "SWAP"].includes(type);
  const showsCustomer = requiresCustomer || ["LOSS", "ADJUSTMENT"].includes(type);

  function changeType(t: MovementType) {
    setType(t);
    setRows([defaultRow(t)]);
    if (t === "MAINTENANCE") setMaintenanceDirection("OUT");
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function buildItems() {
    return rows.map((r) => {
      let { fromLocation, toLocation, condition, toCondition } = r;
      if (type === "MAINTENANCE") {
        fromLocation = maintenanceDirection === "OUT" ? "WAREHOUSE" : "MAINTENANCE";
        toLocation = maintenanceDirection === "OUT" ? "MAINTENANCE" : "WAREHOUSE";
      }
      return {
        kegTypeId: r.kegTypeId,
        quantity: r.quantity,
        condition,
        toCondition: toCondition || null,
        fromLocation,
        toLocation,
      };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (rows.some((r) => !r.kegTypeId)) {
      setError("Selecione o tipo de barril em todos os itens");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          customerId: customerId || null,
          notes: notes || null,
          correctsId: correctsId || null,
          items: buildItems(),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Erro ao registrar movimentação");
        return;
      }
      router.push(`/movimentacoes/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const kegSelect = (r: Row, idx: number) => (
    <Select
      value={r.kegTypeId}
      onChange={(e) => updateRow(idx, { kegTypeId: e.target.value })}
      className="min-w-44"
    >
      <option value="">Tipo de barril…</option>
      {kegTypes.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.code})
        </option>
      ))}
    </Select>
  );

  const qtyInput = (r: Row, idx: number) => (
    <Input
      type="number"
      min={1}
      value={r.quantity}
      onChange={(e) => updateRow(idx, { quantity: Number(e.target.value) })}
      className="w-24"
    />
  );

  const condSelect = (
    value: Condition | "",
    onChange: (v: Condition) => void,
    allowEmpty = false,
  ) => (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as Condition)}
      className="w-32"
    >
      {allowEmpty && <option value="">— igual —</option>}
      <option value="FULL">{CONDITION_LABELS.FULL}</option>
      <option value="EMPTY">{CONDITION_LABELS.EMPTY}</option>
    </Select>
  );

  const swapRows = (direction: "OUT" | "IN") =>
    rows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.swapDirection === direction);

  function renderRow(r: Row, idx: number) {
    return (
      <div
        key={idx}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3"
      >
        {kegSelect(r, idx)}
        {qtyInput(r, idx)}

        {type === "PICKUP" && (
          <>
            <span className="text-xs text-muted-foreground">no cliente:</span>
            {condSelect(r.condition, (v) => updateRow(idx, { condition: v }))}
            <span className="text-xs text-muted-foreground">retorna:</span>
            {condSelect((r.toCondition || r.condition) as Condition, (v) =>
              updateRow(idx, { toCondition: v }),
            )}
          </>
        )}
        {(type === "PURCHASE" || type === "SALE" || type === "MAINTENANCE") && (
          <>
            <span className="text-xs text-muted-foreground">condição:</span>
            {condSelect(r.condition, (v) => updateRow(idx, { condition: v }))}
          </>
        )}
        {type === "LOSS" && (
          <>
            <span className="text-xs text-muted-foreground">origem:</span>
            <Select
              value={r.fromLocation}
              onChange={(e) => updateRow(idx, { fromLocation: e.target.value as Location })}
              className="w-36"
            >
              <option value="WAREHOUSE">Depósito</option>
              <option value="CUSTOMER">Cliente</option>
              <option value="MAINTENANCE">Manutenção</option>
            </Select>
            <span className="text-xs text-muted-foreground">condição:</span>
            {condSelect(r.condition, (v) => updateRow(idx, { condition: v }))}
          </>
        )}
        {type === "SWAP" && r.swapDirection === "IN" && (
          <>
            <span className="text-xs text-muted-foreground">no cliente:</span>
            {condSelect(r.condition, (v) => updateRow(idx, { condition: v }))}
          </>
        )}
        {type === "ADJUSTMENT" && (
          <>
            <Select
              value={r.fromLocation}
              onChange={(e) => updateRow(idx, { fromLocation: e.target.value as Location })}
              className="w-36"
            >
              {(Object.keys(LOCATION_LABELS) as Location[]).map((l) => (
                <option key={l} value={l}>
                  de: {LOCATION_LABELS[l]}
                </option>
              ))}
            </Select>
            {condSelect(r.condition, (v) => updateRow(idx, { condition: v }))}
            <span className="text-muted-foreground">→</span>
            <Select
              value={r.toLocation}
              onChange={(e) => updateRow(idx, { toLocation: e.target.value as Location })}
              className="w-36"
            >
              {(Object.keys(LOCATION_LABELS) as Location[]).map((l) => (
                <option key={l} value={l}>
                  para: {LOCATION_LABELS[l]}
                </option>
              ))}
            </Select>
            {condSelect(r.toCondition, (v) => updateRow(idx, { toCondition: v }), true)}
          </>
        )}

        <button
          type="button"
          onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}
          disabled={rows.length === 1}
          className="ml-auto text-muted-foreground hover:text-danger disabled:opacity-30"
          aria-label="Remover item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-4xl">
      {correctsId && (
        <p className="mb-4 rounded-lg bg-warning/15 px-4 py-3 text-sm text-warning">
          Você está criando uma <strong>movimentação corretiva</strong>. A
          movimentação original permanece no histórico.
        </p>
      )}
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tipo de movimentação">
            <Select
              value={type}
              onChange={(e) => changeType(e.target.value as MovementType)}
              disabled={!!correctsId}
            >
              {MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          {showsCustomer && (
            <Field label={requiresCustomer ? "Cliente *" : "Cliente (se aplicável)"}>
              <Select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required={requiresCustomer}
              >
                <option value="">Selecione…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === "BLOCKED" ? " (bloqueado)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {type === "MAINTENANCE" && (
            <Field label="Direção">
              <Select
                value={maintenanceDirection}
                onChange={(e) => setMaintenanceDirection(e.target.value as "IN" | "OUT")}
              >
                <option value="OUT">Enviar para manutenção</option>
                <option value="IN">Retornar da manutenção</option>
              </Select>
            </Field>
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{TYPE_HELP[type]}</p>

        <div className="mt-6 space-y-4">
          {type === "SWAP" ? (
            <>
              <div>
                <div className="mb-2 text-sm font-semibold text-success">
                  Entregar ao cliente (cheios)
                </div>
                <div className="space-y-2">
                  {swapRows("OUT").map(({ r, idx }) => renderRow(r, idx))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setRows((rs) => [...rs, defaultRow("SWAP", "OUT")])}
                >
                  <Plus className="h-3.5 w-3.5" /> Item de entrega
                </Button>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-info">
                  Retirar do cliente (retornam vazios)
                </div>
                <div className="space-y-2">
                  {swapRows("IN").map(({ r, idx }) => renderRow(r, idx))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setRows((rs) => [...rs, defaultRow("SWAP", "IN")])}
                >
                  <Plus className="h-3.5 w-3.5" /> Item de retirada
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">{rows.map((r, idx) => renderRow(r, idx))}</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRows((rs) => [...rs, defaultRow(type)])}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </Button>
            </>
          )}
        </div>

        <div className="mt-6">
          <Field label="Observações">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes da operação, motorista, nota fiscal…"
            />
          </Field>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Registrando…" : "Registrar movimentação"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
