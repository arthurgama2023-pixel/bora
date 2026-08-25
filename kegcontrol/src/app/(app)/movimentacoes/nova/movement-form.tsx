"use client";

import { Beer, Plus, SlidersHorizontal, Trash2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  type KegCategory,
  type Location,
  type MovementType,
} from "@/lib/enums";
import { cn, formatCurrency } from "@/lib/utils";
import { MOVEMENT_TYPE_ICONS } from "@/lib/movement-icons";
import { imageForKegType } from "@/lib/keg-images";

type KegTypeOption = { id: string; name: string; code: string; category?: string };
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

// Fora do quadrado por pedido do dono: Ajuste, Perda, Manutenção e Venda
// continuam existindo (histórico, correção de movimentação, ajuste de
// estoque do cliente) — só não aparecem como opção pra criar uma
// movimentação nova. Venda saiu porque toda Entrega/Retirada já é venda.
const HIDDEN_FROM_PICKER: readonly MovementType[] = ["ADJUSTMENT", "LOSS", "MAINTENANCE", "SALE"];
const PICKER_TYPES = MOVEMENT_TYPES.filter((t) => !HIDDEN_FROM_PICKER.includes(t));

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
  initialType,
  initialCustomerId,
}: {
  kegTypes: KegTypeOption[];
  customers: CustomerOption[];
  correctsId?: string;
  initialType?: MovementType;
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const startType = initialType ?? (correctsId ? "ADJUSTMENT" : "DELIVERY");
  const [type, setType] = useState<MovementType>(startType);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [notes, setNotes] = useState("");
  // Tipos "visuais" (grid de fotos com +/-) começam sem linha nenhuma — cada
  // clique no + já cria a linha. Os demais (Ajuste/correção) mantêm o modelo
  // antigo de formulário livre, que precisa de uma linha em branco pra editar.
  const [rows, setRows] = useState<Row[]>(
    HIDDEN_FROM_PICKER.includes(startType) ? [defaultRow(startType)] : [],
  );
  const [maintenanceDirection, setMaintenanceDirection] = useState<"IN" | "OUT">("OUT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Preço que o cliente selecionado paga de costume, por tipo de barril — só
  // referência visual ao lado do item, não é gravado na movimentação.
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!customerId) {
      setCustomerPrices({});
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/customers/${customerId}/prices`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        const map: Record<string, number> = {};
        for (const p of json.data as { kegTypeId: string; price: number }[]) {
          if (p.price > 0) map[p.kegTypeId] = p.price;
        }
        setCustomerPrices(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const requiresCustomer = ["DELIVERY", "PICKUP", "SWAP"].includes(type);
  const showsCustomer = requiresCustomer || ["LOSS", "ADJUSTMENT"].includes(type);

  const useCardGrid = !HIDDEN_FROM_PICKER.includes(type);

  function changeType(t: MovementType) {
    setType(t);
    setRows(HIDDEN_FROM_PICKER.includes(t) ? [defaultRow(t)] : []);
    if (t === "MAINTENANCE") setMaintenanceDirection("OUT");
  }

  // Quantidade atual de um tipo de barril nos cards com foto (0 = não
  // adicionado ainda). Na Troca, cada direção (entrega/retirada) tem sua
  // própria contagem pro mesmo tipo de barril.
  function quantityFor(kegTypeId: string, direction: "OUT" | "IN" = "OUT") {
    return (
      rows.find((r) => r.kegTypeId === kegTypeId && (type !== "SWAP" || r.swapDirection === direction))
        ?.quantity ?? 0
    );
  }

  // Clique no + ou no − do card: ajusta a linha correspondente, criando-a na
  // hora se ainda não existir, e removendo se a quantidade zerar.
  function setQuantity(kegTypeId: string, quantity: number, direction: "OUT" | "IN" = "OUT") {
    setRows((rs) => {
      const idx = rs.findIndex(
        (r) => r.kegTypeId === kegTypeId && (type !== "SWAP" || r.swapDirection === direction),
      );
      if (quantity <= 0) {
        return idx >= 0 ? rs.filter((_, i) => i !== idx) : rs;
      }
      if (idx >= 0) {
        const copy = [...rs];
        copy[idx] = { ...copy[idx], quantity };
        return copy;
      }
      return [...rs, { ...defaultRow(type, direction), kegTypeId, quantity }];
    });
  }

  // Chip de item pré-selecionado (tipo já registrado em Barris/Chopeiras): se
  // houver uma linha vazia na direção certa, preenche ela; senão cria uma nova.
  function pickKegType(kegTypeId: string, direction: "OUT" | "IN" = "OUT") {
    setRows((rs) => {
      const idx = rs.findIndex(
        (r) => r.kegTypeId === "" && (type !== "SWAP" || r.swapDirection === direction),
      );
      if (idx >= 0) {
        const copy = [...rs];
        copy[idx] = { ...copy[idx], kegTypeId };
        return copy;
      }
      return [...rs, { ...defaultRow(type, direction), kegTypeId }];
    });
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
    if (rows.length === 0) {
      setError("Adicione ao menos um item");
      return;
    }
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

  // Itens pré-selecionados — tudo que já está registrado em Barris/Chopeiras,
  // agrupado por categoria pra achar mais rápido. Clicar já bota o item na
  // movimentação, sem precisar procurar no dropdown.
  function kegTypeChips(direction: "OUT" | "IN" = "OUT") {
    if (kegTypes.length === 0) return null;
    const groups: { label: string; icon: typeof Zap; items: KegTypeOption[] }[] = [
      { label: "Chopeiras", icon: Zap, items: kegTypes.filter((t) => t.category === "CHOPEIRA") },
      { label: "Barris", icon: Beer, items: kegTypes.filter((t) => t.category !== "CHOPEIRA") },
    ].filter((g) => g.items.length > 0);

    return (
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <g.icon className="h-3.5 w-3.5" />
              {g.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {g.items.map((t) => {
                const price = customerId ? customerPrices[t.id] : undefined;
                const isChopeira = t.category === "CHOPEIRA";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickKegType(t.id, direction)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                      isChopeira
                        ? "border-info/40 bg-info/10 text-info hover:bg-info/20"
                        : "border-brand/40 bg-brand/10 text-brand-strong hover:bg-brand/20",
                    )}
                  >
                    {t.name}
                    <span className="font-mono text-xs font-normal opacity-60">{t.code}</span>
                    {price ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                        {formatCurrency(price)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Grid com foto real do barril/chopeira + botões +/− pra ajustar a
  // quantidade direto no card — igual ao site do cliente. Usado nos tipos
  // "visuais" (Entrega/Retirada/Troca/Compra); substitui dropdown+input.
  function kegImageCards(direction: "OUT" | "IN" = "OUT") {
    if (kegTypes.length === 0) return null;
    const groups: { label: string; icon: typeof Zap; items: KegTypeOption[] }[] = [
      { label: "Chopeiras", icon: Zap, items: kegTypes.filter((t) => t.category === "CHOPEIRA") },
      { label: "Barris", icon: Beer, items: kegTypes.filter((t) => t.category !== "CHOPEIRA") },
    ].filter((g) => g.items.length > 0);

    return (
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <g.icon className="h-3.5 w-3.5" />
              {g.label}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((t) => {
                const qty = quantityFor(t.id, direction);
                const price = customerId ? customerPrices[t.id] : undefined;
                const image = imageForKegType(t.name);
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-xl border bg-card transition-colors",
                      qty > 0 ? "border-brand shadow-sm" : "border-border",
                    )}
                  >
                    <div className="flex h-24 items-center justify-center overflow-hidden bg-muted/40">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={t.name} className="h-full w-full object-cover" />
                      ) : (
                        <Beer className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{t.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{t.code}</p>
                      </div>
                      {price ? (
                        <span className="w-fit rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                          {formatCurrency(price)}
                        </span>
                      ) : null}
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setQuantity(t.id, qty - 1, direction)}
                          disabled={qty === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-lg font-bold leading-none transition-colors hover:bg-muted disabled:opacity-30"
                          aria-label={`Diminuir ${t.name}`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-base font-bold">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(t.id, qty + 1, direction)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand bg-brand/10 text-lg font-bold leading-none text-brand-strong transition-colors hover:bg-brand/20"
                          aria-label={`Aumentar ${t.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderRow(r: Row, idx: number) {
    return (
      <div
        key={idx}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3"
      >
        {kegSelect(r, idx)}
        {qtyInput(r, idx)}
        {customerId && r.kegTypeId && customerPrices[r.kegTypeId] > 0 && (
          <span className="text-xs font-medium text-success">
            cliente paga {formatCurrency(customerPrices[r.kegTypeId])}
          </span>
        )}

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
          onClick={() => {
            if (rows.length === 1) {
              // último item: não dá pra remover a linha (tem que sobrar
              // pelo menos uma), então zera ela de volta ao padrão.
              setRows([defaultRow(type, r.swapDirection)]);
            } else {
              setRows((rs) => rs.filter((_, i) => i !== idx));
            }
          }}
          className="ml-auto text-muted-foreground hover:text-danger"
          aria-label={rows.length === 1 ? "Limpar item" : "Remover item"}
          title={rows.length === 1 ? "Limpar item" : "Remover item"}
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
      {!correctsId && initialCustomerId && (
        <p className="mb-4 rounded-lg bg-info/15 px-4 py-3 text-sm text-info">
          Editando o estoque deste cliente por <strong>ajuste</strong>. O
          estoque não é alterado direto — cada mudança vira uma movimentação,
          mantendo o histórico. Para zerar um item, ajuste-o para a condição
          de destino "Depósito" com a quantidade que ele tem.
        </p>
      )}
      <Card className="p-6">
        <Field label="Tipo de movimentação">
          {correctsId || HIDDEN_FROM_PICKER.includes(type) ? (
            <div className="flex w-fit items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold">
              <SlidersHorizontal className="h-5 w-5" />
              {MOVEMENT_TYPE_LABELS[type]}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PICKER_TYPES.map((t) => {
                const Icon = MOVEMENT_TYPE_ICONS[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => changeType(t)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-sm font-semibold transition-colors",
                      active
                        ? "border-brand bg-brand text-brand-foreground shadow-sm"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-7 w-7" />
                    {MOVEMENT_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
          {useCardGrid ? (
            type === "SWAP" ? (
              <>
                <div>
                  <div className="mb-2 text-sm font-semibold text-success">
                    Entregar ao cliente (cheios)
                  </div>
                  {kegImageCards("OUT")}
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-info">
                    Retirar do cliente (retornam vazios)
                  </div>
                  {kegImageCards("IN")}
                </div>
              </>
            ) : (
              kegImageCards("OUT")
            )
          ) : (
            <>
              <div className="mb-2">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Itens já registrados — clique para adicionar
                </span>
                {kegTypeChips("OUT")}
              </div>
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
