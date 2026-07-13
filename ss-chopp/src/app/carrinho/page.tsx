"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProductById } from "@/data/products";
import { useCart, formatPrice } from "@/lib/cart-context";
import { useLocation } from "@/lib/location-context";

const WHATSAPP_NUMBER = "5521993765465";

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
  const { items, updateQuantity, removeItem, subtotal, deliveryFee, total, minimumOrder, meetsMinimum, clearCart, unitPrice } =
    useCart();
  const { zone } = useLocation();
  const [sent, setSent] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("entrega");
  const [address, setAddress] = useState({ nome: "", rua: "", numero: "", bairro: "", complemento: "", cpfCnpj: "" });

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
  const addressComplete = address.rua && address.numero && address.bairro && address.cpfCnpj;
  const canFinish =
    meetsMinimum && !!address.nome && (deliveryMethod === "retirada" || addressComplete);

  const isCPFValid = !address.cpfCnpj || isValidCPFOrCNPJ(address.cpfCnpj);

  function handleSendToWhatsApp() {
    const lines = items.map((item) => {
      const product = getProductById(item.productId);
      if (!product) return "";
      const lineTotal = unitPrice(item.productId) * item.quantity;
      return `    ${product.emoji} ${product.name}\n       ${item.quantity}x = ${formatPrice(lineTotal)}`;
    });

    const deliveryLabel = deliveryMethod === "entrega" ? "🚚 Entrega" : "🏪 Retirada na loja";
    const zoneLine = zone ? [`📍 *REGIÃO*: ${zone.name} — ${zone.city} (entrega ${zone.eta.toLowerCase()})`, ""] : [];
    const addressLines =
      deliveryMethod === "entrega"
        ? [
            "",
            "📍 *ENDEREÇO DE ENTREGA*",
            `Rua: ${address.rua}, ${address.numero}`,
            `Bairro: ${address.bairro}${address.complemento ? `\nComplemento: ${address.complemento}` : ""}`,
          ]
        : [];

    const summary = [
      "╔════════════════════════════════╗",
      "║  🍺 PEDIDO SS-CHOPP DISTRIBUIDORA  ║",
      "╚════════════════════════════════╝",
      "",
      ...zoneLine,
      "📦 *ITENS DO PEDIDO*",
      ...lines,
      "",
      "─────────────────────────────────",
      `💰 Subtotal: ${formatPrice(subtotal)}`,
      `🚛 Taxa de entrega: ${finalDeliveryFee > 0 ? formatPrice(finalDeliveryFee) : "GRÁTIS 🎉"}`,
      "",
      `✅ *TOTAL: ${formatPrice(finalTotal)}*`,
      "─────────────────────────────────",
      "",
      `${deliveryLabel}`,
      ...addressLines,
      "",
      `👤 Nome: ${address.nome}`,
      `🪪 CPF/CNPJ: ${address.cpfCnpj}`,
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
          const lineTotal = unitPrice(item.productId) * item.quantity;

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
                <p className="text-sm text-gray-500">{formatPrice(unitPrice(item.productId))}/un.</p>
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

      <div className="mt-6 rounded-xl border border-brand-black/10 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold text-brand-black">Seus dados</h2>
        <input
          placeholder="Nome completo"
          value={address.nome}
          onChange={(e) => setAddress({ ...address, nome: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
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
