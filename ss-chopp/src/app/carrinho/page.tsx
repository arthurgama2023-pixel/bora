"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProductById } from "@/data/products";
import { useCart, formatPrice } from "@/lib/cart-context";
import { useLocation } from "@/lib/location-context";
import { getCaxiasSavings } from "@/data/caxias-pricing";

const WHATSAPP_NUMBER = "5521993765465";

// Único meio de pagamento aceito: Pix direto pro estabelecimento.
const PIX_KEY = "20994543000189";
const PIX_MERCHANT_NAME = "Ss Chopp Expresso";

// Chopeira tem duas opções físicas — o cliente escolhe uma vez pro pedido
// inteiro (o kit de praticamente todo produto inclui uma chopeira).
const CHOPEIRA_VARIANTS = [
  { value: "eletrica", label: "Elétrica" },
  { value: "gelo", label: "De gelo" },
];

type DeliveryMethod = "entrega" | "retirada";

function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  digit1 = digit1 > 9 ? 0 : digit1;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  digit2 = digit2 > 9 ? 0 : digit2;

  return cleaned[9] === String(digit1) && cleaned[10] === String(digit2);
}

function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  let sum = 0;
  let multiplier = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }
  let digit1 = 11 - (sum % 11);
  digit1 = digit1 > 9 ? 0 : digit1;

  sum = 0;
  multiplier = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }
  let digit2 = 11 - (sum % 11);
  digit2 = digit2 > 9 ? 0 : digit2;

  return cleaned[12] === String(digit1) && cleaned[13] === String(digit2);
}

function isValidCPFOrCNPJ(value: string): boolean {
  return validateCPF(value) || validateCNPJ(value);
}

export default function CarrinhoPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    subtotal,
    deliveryFee,
    total,
    minimumOrder,
    meetsMinimum,
    clearCart,
    unitPrice,
    chopeiraType,
    setChopeiraType,
    hasChopeira,
  } = useCart();
  const { zone } = useLocation();
  const [sent, setSent] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("entrega");
  const [pixCopiado, setPixCopiado] = useState(false);
  const [address, setAddress] = useState({
    nome: "",
    email: "",
    rua: "",
    numero: "",
    bairro: "",
    complemento: "",
    cpfCnpj: "",
    dataEvento: "",
    horarioEvento: "",
    temEscada: "" as "" | "sim" | "nao",
    tipoLocal: "" as "" | "casa" | "salao",
  });

  // já que o cliente escolheu o bairro na entrada, joga ele no endereço
  useEffect(() => {
    if (zone && !address.bairro) setAddress((a) => ({ ...a, bairro: zone.name }));
  }, [zone, address.bairro]);

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">✅</p>
        <h1 className="mt-4 text-xl font-bold text-brand-black">Pedido enviado!</h1>
        <p className="mt-2 text-gray-600">
          Abrimos o WhatsApp com o resumo do seu pedido. Finalize por lá com a SS-Chopp.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-brand-amber px-6 py-2 font-bold text-white hover:brightness-110"
        >
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-4 text-xl font-bold text-brand-black">Seu carrinho está vazio</h1>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-brand-amber px-6 py-2 font-bold text-white hover:brightness-110"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  const finalDeliveryFee = deliveryMethod === "entrega" ? deliveryFee : 0;
  const finalTotal = subtotal + finalDeliveryFee;
  // Sinal pra confirmar a reserva: sempre 50% do total do pedido.
  const sinal = finalTotal * 0.5;
  const addressComplete = address.rua && address.numero && address.bairro && address.cpfCnpj;
  const chopeiraEscolhida = !hasChopeira || !!chopeiraType;
  const canFinish =
    meetsMinimum &&
    !!address.nome &&
    (deliveryMethod === "retirada" || addressComplete) &&
    chopeiraEscolhida;

  const isCPFValid = !address.cpfCnpj || isValidCPFOrCNPJ(address.cpfCnpj);

  function copiarChavePix() {
    navigator.clipboard
      .writeText(PIX_KEY)
      .then(() => {
        setPixCopiado(true);
        setTimeout(() => setPixCopiado(false), 2000);
      })
      .catch(() => {});
  }

  function handleSendToWhatsApp() {
    const lines = items.map((item) => {
      const product = getProductById(item.productId);
      if (!product) return "";
      const lineTotal = unitPrice(item.productId, item.quantity) * item.quantity;
      return `    ${product.emoji} ${product.name}\n       ${item.quantity}x = ${formatPrice(lineTotal)}`;
    });

    const chopeiraLabel = chopeiraType
      ? CHOPEIRA_VARIANTS.find((v) => v.value === chopeiraType)?.label ?? chopeiraType
      : null;

    const deliveryLabel = deliveryMethod === "entrega" ? "🚚 Entrega" : "🏪 Retirada na loja";
    const zoneLine = zone
      ? [`📍 *REGIÃO*: ${zone.name} — ${zone.city}${zone.eta ? ` (entrega ${zone.eta.toLowerCase()})` : ""}`, ""]
      : [];
    const dataFormatada = address.dataEvento
      ? new Date(`${address.dataEvento}T00:00:00`).toLocaleDateString("pt-BR")
      : "";
    const eventoLines = [
      ...(dataFormatada ? [`📅 Data da festa: ${dataFormatada}`] : []),
      ...(address.horarioEvento ? [`🕐 Horário do evento: ${address.horarioEvento}`] : []),
    ];
    const addressLines =
      deliveryMethod === "entrega"
        ? [
            "",
            "📍 *ENDEREÇO DE ENTREGA*",
            `Rua: ${address.rua}, ${address.numero}`,
            `Bairro: ${address.bairro}${address.complemento ? `\nComplemento: ${address.complemento}` : ""}`,
            `Tem escada: ${address.temEscada === "sim" ? "Sim" : address.temEscada === "nao" ? "Não" : "Não informado"}`,
            `Local do evento: ${address.tipoLocal === "casa" ? "Casa" : address.tipoLocal === "salao" ? "Salão" : "Não informado"}`,
          ]
        : [];

    const summary = [
      "╔════════════════════════════════╗",
      "║  🍺 PEDIDO SS-CHOPP DISTRIBUIDORA  ║",
      "╚════════════════════════════════╝",
      "",
      ...zoneLine,
      ...(eventoLines.length ? [...eventoLines, ""] : []),
      "📦 *ITENS DO PEDIDO*",
      ...lines,
      ...(chopeiraLabel ? ["", `🍺 Chopeira: ${chopeiraLabel}`] : []),
      "",
      "─────────────────────────────────",
      `💰 Subtotal: ${formatPrice(subtotal)}`,
      `🚛 Taxa de entrega: ${finalDeliveryFee > 0 ? formatPrice(finalDeliveryFee) : "GRÁTIS 🎉"}`,
      "",
      `✅ *TOTAL: ${formatPrice(finalTotal)}*`,
      `🔒 Sinal para confirmar (50%): ${formatPrice(sinal)}`,
      "─────────────────────────────────",
      "",
      `${deliveryLabel}`,
      ...addressLines,
      "",
      `👤 Nome: ${address.nome}`,
      ...(address.email ? [`📧 E-mail: ${address.email}`] : []),
      `🪪 CPF/CNPJ: ${address.cpfCnpj}`,
      `💳 Pagamento: Pix`,
      "",
      "💬 Confirme o pedido por favor!",
    ].join("\n");

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(summary)}`;
    window.open(url, "_blank");
    setSent(true);
    clearCart();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold text-brand-black">Seu Carrinho</h1>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const product = getProductById(item.productId);
          if (!product) return null;
          const lineTotal = unitPrice(item.productId, item.quantity) * item.quantity;
          const savings = zone?.fixed ? getCaxiasSavings(item.productId, item.quantity) : 0;

          return (
            <div
              key={item.productId}
              className="flex items-center gap-4 rounded-xl border border-brand-black/10 bg-white p-3 shadow-sm"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-cream text-3xl">
                {product.image ? (
                  <img
                    src={`${product.image}?w=120&q=80&auto=format&fit=crop`}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  product.emoji
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-brand-black">{product.name}</p>
                <p className="text-sm text-gray-500">{formatPrice(unitPrice(item.productId, item.quantity))}/un.</p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                    className="h-7 w-7 rounded-full bg-gray-100 font-bold hover:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="h-7 w-7 rounded-full bg-gray-100 font-bold hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-bold text-brand-amber">{formatPrice(lineTotal)}</p>
                {savings > 0 && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
                    economizou {formatPrice(savings)}
                  </span>
                )}
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-xs text-gray-400 hover:text-brand-amber"
                >
                  remover
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!meetsMinimum && (
        <p className="mt-4 rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          Pedido mínimo de {formatPrice(minimumOrder)}. Faltam {formatPrice(minimumOrder - subtotal)} para finalizar.
        </p>
      )}
      {!chopeiraEscolhida && (
        <p className="mt-4 rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          Escolha qual chopeira você prefere (elétrica ou de gelo) para finalizar.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-brand-black/10 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold text-brand-black">Seus dados</h2>
        <div className="flex flex-col gap-2">
          <input
            placeholder="Nome completo"
            value={address.nome}
            onChange={(e) => setAddress({ ...address, nome: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="E-mail"
            value={address.email}
            onChange={(e) => setAddress({ ...address, email: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {hasChopeira && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Qual chopeira você prefere?</label>
            <div className="flex gap-2">
              {CHOPEIRA_VARIANTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setChopeiraType(v.value)}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    chopeiraType === v.value
                      ? "bg-brand-black text-brand-cream"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-brand-black/10 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold text-brand-black">Entrega ou retirada?</h2>
        <div className="flex gap-2">
          {(["entrega", "retirada"] as DeliveryMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setDeliveryMethod(m)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                deliveryMethod === m
                  ? "bg-brand-black text-brand-cream"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {m === "entrega" ? "Entrega" : "Retirada na loja"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Para qual data?</label>
            <input
              type="date"
              value={address.dataEvento}
              onChange={(e) => setAddress({ ...address, dataEvento: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Horário do evento?</label>
            <input
              type="time"
              value={address.horarioEvento}
              onChange={(e) => setAddress({ ...address, horarioEvento: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {deliveryMethod === "entrega" && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <input
              placeholder="Rua"
              value={address.rua}
              onChange={(e) => setAddress({ ...address, rua: e.target.value })}
              className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Número"
              value={address.numero}
              onChange={(e) => setAddress({ ...address, numero: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Bairro"
              value={address.bairro}
              onChange={(e) => setAddress({ ...address, bairro: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Complemento (opcional)"
              value={address.complemento}
              onChange={(e) => setAddress({ ...address, complemento: e.target.value })}
              className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Tem escada no local?</label>
              <div className="flex gap-2">
                {(["sim", "nao"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAddress({ ...address, temEscada: v })}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      address.temEscada === v
                        ? "bg-brand-black text-brand-cream"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {v === "sim" ? "Sim" : "Não"}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-500">O evento será casa ou salão?</label>
              <div className="flex gap-2">
                {(["casa", "salao"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAddress({ ...address, tipoLocal: v })}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      address.tipoLocal === v
                        ? "bg-brand-black text-brand-cream"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {v === "casa" ? "Casa" : "Salão"}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex gap-2 items-center">
              <input
                placeholder="CPF ou CNPJ"
                value={address.cpfCnpj}
                onChange={(e) => setAddress({ ...address, cpfCnpj: e.target.value })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  address.cpfCnpj
                    ? isCPFValid
                      ? "border-green-500 bg-green-50"
                      : "border-red-500 bg-red-50"
                    : "border-gray-300"
                }`}
              />
              {address.cpfCnpj && (
                <span className="text-lg">
                  {isCPFValid ? "✅" : "❌"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-green-600/20 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-green-600 px-4 py-3">
          <span className="text-lg">🔒</span>
          <h2 className="font-bold text-white">Pagamento seguro via Pix</h2>
        </div>

        <div className="p-4">
          <div className="rounded-lg border border-green-600/30 bg-green-50 px-4 py-3">
            <p className="text-sm text-gray-700">Sinal para confirmar a reserva (50% do pedido)</p>
            <p className="text-2xl font-extrabold text-green-700">{formatPrice(sinal)}</p>
            <p className="mt-1 text-xs text-gray-500">
              O restante ({formatPrice(finalTotal - sinal)}) é acertado{" "}
              {deliveryMethod === "entrega" ? "na entrega" : "na retirada"}.
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chave Pix (CNPJ)</p>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                <span aria-hidden>✓</span> Verificada
              </span>
            </div>
            <p className="mt-0.5 font-mono text-base font-bold tracking-wide text-brand-black">{PIX_KEY}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Favorecido</p>
            <p className="text-sm font-bold text-brand-black">{PIX_MERCHANT_NAME}</p>
          </div>

          <button
            type="button"
            onClick={copiarChavePix}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
              pixCopiado
                ? "bg-green-600 text-white"
                : "bg-brand-black text-brand-cream hover:brightness-110"
            }`}
          >
            {pixCopiado ? (
              <>✅ Chave copiada!</>
            ) : (
              <>📋 Copiar chave Pix</>
            )}
          </button>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
            <span aria-hidden>🔒</span>
            O pagamento é feito direto no app do seu banco — a SS-Chopp não recebe nem guarda seus dados bancários.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-brand-black/10 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Taxa de entrega</span>
          {finalDeliveryFee > 0 ? (
            <span>{formatPrice(finalDeliveryFee)}</span>
          ) : (
            <span className="font-bold text-green-600">Grátis 🎉</span>
          )}
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-lg font-extrabold text-brand-black">
          <span>Total</span>
          <span>{formatPrice(finalTotal)}</span>
        </div>
      </div>

      <button
        onClick={handleSendToWhatsApp}
        disabled={!canFinish}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-center font-bold text-white transition ${
          canFinish ? "bg-green-600 hover:brightness-110" : "pointer-events-none bg-gray-300"
        }`}
      >
        Finalizar pedido via WhatsApp
      </button>
    </div>
  );
}
