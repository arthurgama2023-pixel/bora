"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProductById } from "@/data/products";
import { useCart, formatPrice, formatWeight } from "@/lib/cart-context";

type DeliveryMethod = "entrega" | "retirada";
type PaymentMethod = "pix" | "cartao" | "dinheiro";

const WHATSAPP_NUMBER = "5500000000000";

export default function CheckoutPage() {
  const { items, subtotal, deliveryFee, total, clearCart } = useCart();
  const router = useRouter();

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("entrega");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [address, setAddress] = useState({ rua: "", numero: "", bairro: "", complemento: "" });
  const [finished, setFinished] = useState(false);

  if (items.length === 0 && !finished) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-brand-maroon">Seu carrinho está vazio.</p>
        <Link href="/" className="mt-4 inline-block cursor-pointer font-bold text-brand-red active:underline md:hover:underline">
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const finalDeliveryFee = deliveryMethod === "entrega" ? deliveryFee : 0;
  const finalTotal = subtotal + finalDeliveryFee;

  function buildSummary() {
    const lines = items.map((item) => {
      const product = getProductById(item.productId);
      if (!product) return "";
      const isKg = product.unit === "kg";
      const lineTotal = isKg
        ? ((product.pricePerKg ?? 0) * item.amount) / 1000
        : (product.fixedPrice ?? 0) * item.amount;
      const qty = isKg ? formatWeight(item.amount) : `${item.amount}x`;
      return `• ${product.name} (${qty}) - ${formatPrice(lineTotal)}`;
    });

    const paymentLabel = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro na entrega" }[payment];
    const deliveryLabel = deliveryMethod === "entrega" ? "Entrega" : "Retirada na loja";

    const addressLines =
      deliveryMethod === "entrega"
        ? [`Endereço: ${address.rua}, ${address.numero} - ${address.bairro}${address.complemento ? ` (${address.complemento})` : ""}`]
        : [];

    return [
      "Pedido - Rei das Carnes Açougue",
      "",
      ...lines,
      "",
      `Subtotal: ${formatPrice(subtotal)}`,
      `Entrega: ${formatPrice(finalDeliveryFee)}`,
      `Total: ${formatPrice(finalTotal)}`,
      "",
      `Modalidade: ${deliveryLabel}`,
      ...addressLines,
      `Pagamento: ${paymentLabel}`,
    ].join("\n");
  }

  function handleFinish() {
    const summary = buildSummary();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(summary)}`;
    // window.open is unreliable on mobile browsers (popup blockers / app-link handling);
    // a real <a> click is handled natively by the OS for wa.me deep links.
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setFinished(true);
    clearCart();
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">✅</p>
        <h1 className="mt-4 text-xl font-bold text-brand-maroon">Pedido enviado!</h1>
        <p className="mt-2 text-gray-600">
          Abrimos o WhatsApp com o resumo do seu pedido. Finalize por lá com o açougue.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block cursor-pointer rounded-full bg-brand-red px-6 py-2 font-bold text-white active:brightness-90 md:hover:brightness-110"
        >
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 cursor-pointer p-1 text-sm font-semibold text-brand-maroon active:underline md:hover:underline"
      >
        ← Voltar ao carrinho
      </button>
      <h1 className="mb-4 text-2xl font-extrabold text-brand-maroon">Checkout</h1>

      <section className="mb-6 rounded-xl border border-brand-maroon/10 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold text-brand-maroon">Entrega ou retirada?</h2>
        <div className="flex gap-2">
          {(["entrega", "retirada"] as DeliveryMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setDeliveryMethod(m)}
              className={`flex-1 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition ${
                deliveryMethod === m
                  ? "bg-brand-maroon text-brand-cream"
                  : "bg-gray-100 text-gray-700 active:bg-gray-300 md:hover:bg-gray-200"
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
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-brand-maroon/10 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold text-brand-maroon">Forma de pagamento</h2>
        <div className="flex flex-wrap gap-2">
          {([
            { id: "pix", label: "Pix" },
            { id: "cartao", label: "Cartão" },
            { id: "dinheiro", label: "Dinheiro na entrega" },
          ] as { id: PaymentMethod; label: string }[]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPayment(opt.id)}
              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition ${
                payment === opt.id
                  ? "bg-brand-maroon text-brand-cream"
                  : "bg-gray-100 text-gray-700 active:bg-gray-300 md:hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">* Pagamento simulado nesta versão, nenhum dado é processado.</p>
      </section>

      <section className="mb-6 rounded-xl border border-brand-maroon/10 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Entrega</span>
          <span>{formatPrice(finalDeliveryFee)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-lg font-extrabold text-brand-maroon">
          <span>Total</span>
          <span>{formatPrice(finalTotal)}</span>
        </div>
      </section>

      <button
        onClick={handleFinish}
        disabled={deliveryMethod === "entrega" && (!address.rua || !address.numero || !address.bairro)}
        className="block w-full cursor-pointer rounded-full bg-brand-red px-6 py-3 text-center font-bold text-white transition active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 md:hover:brightness-110"
      >
        Finalizar pedido via WhatsApp
      </button>
    </div>
  );
}
