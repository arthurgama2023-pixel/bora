"use client";

// Cartão de preços 1080x1350 (4:5 — formato de imagem do WhatsApp) que o
// agente de IA manda quando o cliente pergunta o preço. Uma tabela por zona:
// os preços vêm ao vivo do KegControl (mesma fonte do site) e caem na tabela
// fixa local se a API não responder.
//
// `?zona=<slug>` escolhe a zona; `?shot=1` esconde o cabeçalho da página e
// deixa só o cartão colado em 0,0 — é o modo que o `npm run tabelas` usa pra
// gerar os PNGs em public/tabelas/ com o Chrome headless.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import {
  CIDADES,
  cidadeFromSlug,
  cidadeSlug,
  formatarReal,
  montarTabela,
  PRICING_URL,
  type Pricing,
} from "@/lib/tabela";

const WHATSAPP = "(21) 99376-5465";
const PEDIDO_MINIMO = 150;

export default function TabelaPage() {
  return (
    <Suspense fallback={null}>
      <Cartao />
    </Suspense>
  );
}

function Cartao() {
  const params = useSearchParams();
  const router = useRouter();
  const [pricing, setPricing] = useState<Pricing | null>(null);

  const cidade = cidadeFromSlug(params.get("zona"));
  const shot = params.get("shot") === "1";

  // Modo print: some com o header do site e o modal de bairro (ver globals.css).
  useEffect(() => {
    document.documentElement.classList.toggle("modo-print", shot);
  }, [shot]);

  useEffect(() => {
    let vivo = true;
    fetch(PRICING_URL)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo || !j?.ok || !j.data) return;
        setPricing({
          products: j.data.products ?? [],
          overrides: j.data.overrides ?? {},
          extraRegions: j.data.extraRegions ?? {},
          removedRegions: j.data.removedRegions ?? {},
        });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const tabela = useMemo(() => montarTabela(pricing, cidade), [pricing, cidade]);

  function trocarZona(c: string) {
    router.replace(`/tabela?zona=${cidadeSlug(c)}`, { scroll: false });
  }

  // Data de hoje: só existe no cliente — o HTML pré-renderizado traz a data do
  // build, então deixamos o React trocar sem reclamar de hidratação.
  const atualizado = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const bairrosResumo = tabela.bairros.slice(0, 9).join(" · ");
  const restantes = Math.max(0, tabela.bairros.length - 9);

  return (
    <div className={shot ? "bg-[#0d0d0d]" : "bg-[#0d0d0d] px-4 py-6"}>
      {!shot && (
        <div className="mx-auto mb-6 flex max-w-[1080px] flex-col gap-3">
          <div>
            <h1 className="text-2xl font-black text-brand-cream">Tabela de preços por zona</h1>
            <p className="text-sm text-brand-cream/60">
              É esta imagem que o agente manda no WhatsApp. Escolha a zona e salve/print o cartão.
              {tabela.aoVivo ? " Preços ao vivo do KegControl." : " Preços do fallback local (API fora)."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CIDADES.map((c) => (
              <button
                key={c}
                onClick={() => trocarZona(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                  c === cidade
                    ? "bg-brand-gold text-brand-black"
                    : "bg-white/10 text-brand-cream hover:bg-white/20"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- o cartão (1080x1350) ---------------- */}
      <div
        id="tabela-card"
        className="mx-auto flex h-[1350px] w-[1080px] shrink-0 flex-col overflow-hidden bg-[#131313] font-sans"
      >
        {/* cabeçalho */}
        <div className="flex shrink-0 items-center gap-6 border-b-[6px] border-brand-gold bg-gradient-to-r from-[#1e1e1e] via-[#151515] to-[#1e1e1e] px-12 py-6">
          <Logo className="h-[96px] w-[96px] shrink-0" />
          <div className="flex-1">
            <p className="text-[15px] font-bold uppercase tracking-[0.3em] text-brand-gold">
              SS-Chopp Distribuidora
            </p>
            <h2 className="whitespace-nowrap text-[50px] font-black leading-tight text-brand-cream">
              TABELA DE PREÇOS
            </h2>
            <p className="text-[18px] font-medium text-brand-cream/55">
              Chopp gelado entregue na sua festa · desde 2016
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-brand-gold/30 bg-black/40 px-5 py-3 text-right">
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-cream/50">
              Pedidos no zap
            </p>
            <p className="whitespace-nowrap text-[28px] font-black leading-tight text-brand-cream">
              {WHATSAPP}
            </p>
          </div>
        </div>

        {/* faixa da zona */}
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-brand-amber to-brand-gold px-12 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-[22px]">📍</span>
            <span className="text-[34px] font-black uppercase tracking-tight text-brand-black">
              {tabela.cidade}
            </span>
            {tabela.eta && (
              <span className="text-[19px] font-bold text-brand-black/65">
                entrega em {tabela.eta.toLowerCase()}
              </span>
            )}
          </div>
          <span className="rounded-full bg-brand-black px-5 py-2 text-[20px] font-black text-brand-gold">
            🚚 FRETE GRÁTIS
          </span>
        </div>

        {/* cabeçalho das colunas */}
        <div className="flex items-center gap-6 border-b border-white/10 bg-white/[0.04] px-12 py-3">
          <div className="flex-1 text-[15px] font-bold uppercase tracking-[0.2em] text-brand-cream/45">
            Barril
          </div>
          <div className="w-[150px] text-center text-[15px] font-bold uppercase tracking-[0.14em] text-brand-cream/45">
            1 barril
          </div>
          <div className="w-[150px] text-center text-[15px] font-bold uppercase tracking-[0.14em] text-brand-cream/45">
            2 barris
          </div>
          <div className="w-[186px] text-center text-[15px] font-black uppercase tracking-[0.14em] text-brand-gold">
            3+ barris ★
          </div>
        </div>

        {/* linhas */}
        <div className="flex flex-1 flex-col">
          {tabela.linhas.map((l, i) => (
            <div
              key={l.id}
              className={`flex flex-1 items-center gap-6 px-12 ${
                i % 2 ? "bg-white/[0.03]" : ""
              } ${i ? "border-t border-white/5" : ""}`}
            >
              <div
                className="h-[86px] w-[86px] shrink-0 overflow-hidden rounded-2xl border-2"
                style={{ borderColor: `${l.cor}aa` }}
              >
                {l.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.foto.replace("/logos/", "/logos/og/").replace(".webp", ".png")}
                    alt={l.nome}
                    width={86}
                    height={86}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-[32px] font-black leading-none text-brand-cream">
                    {l.nome}
                  </span>
                  <span
                    className="rounded-lg px-2.5 py-1 text-[19px] font-black leading-none text-white"
                    style={{ backgroundColor: l.cor }}
                  >
                    {l.litros}L
                  </span>
                </div>
                <p className="mt-1.5 text-[17px] font-medium text-brand-cream/45">
                  {l.pessoas} · peça {l.antecedencia} antes
                </p>
              </div>

              {l.tiers ? (
                <>
                  <div className="w-[150px] text-center text-[27px] font-bold text-brand-cream/75">
                    {formatarReal(l.tiers[0])}
                  </div>
                  <div className="w-[150px] text-center text-[27px] font-bold text-brand-cream/75">
                    {formatarReal(l.tiers[1])}
                  </div>
                </>
              ) : (
                <div className="w-[150px] text-right text-[15px] font-medium leading-tight text-brand-cream/40">
                  preço único
                  <br />
                  qualquer qtd.
                </div>
              )}
              {/* Sempre o mesmo slot (186px) — é o que mantém o preço em
                  destaque alinhado entre barris com faixa e preço fixo. */}
              <div className="w-[186px] px-2">
                <div className="rounded-xl border border-brand-gold/45 bg-brand-gold/15 py-2 text-center text-[32px] font-black text-brand-gold">
                  {formatarReal(l.tiers ? l.tiers[2] : (l.fixo ?? 0))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* extras */}
        <div className="flex shrink-0 items-center gap-4 border-t border-white/10 bg-white/[0.04] px-12 py-3.5">
          <span className="shrink-0 text-[15px] font-bold uppercase tracking-[0.2em] text-brand-cream/45">
            Equipamento
          </span>
          {tabela.extras.map((e) => (
            <span
              key={e.id}
              className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-black/40 px-5 py-2 text-[19px] font-bold text-brand-cream/85"
            >
              {e.emoji} {e.nome}
              <b className="text-brand-gold">
                {e.preco ? formatarReal(e.preco) : "sob consulta"}
              </b>
            </span>
          ))}
        </div>

        {/* regras */}
        <div className="flex shrink-0 items-center justify-between gap-4 px-12 py-3.5">
          {[
            ["🧊", "30L: peça 24h antes · 50L: 48h antes"],
            ["🛒", `Pedido mínimo ${formatarReal(PEDIDO_MINIMO)}`],
            ["🏠", "Entrega ou retirada na loja"],
          ].map(([emoji, texto]) => (
            <span
              key={texto}
              className="flex items-center gap-2 whitespace-nowrap text-[18px] font-semibold text-brand-cream/70"
            >
              <span className="text-[22px]">{emoji}</span>
              {texto}
            </span>
          ))}
        </div>

        {/* rodapé */}
        <div className="shrink-0 bg-gradient-to-r from-[#1e1e1e] via-[#151515] to-[#1e1e1e] px-12 py-4">
          <p className="text-[15px] leading-snug text-brand-cream/40">
            <b className="text-brand-cream/60">Atendemos:</b> {bairrosResumo}
            {restantes > 0 ? ` · e mais ${restantes} ${restantes === 1 ? "bairro" : "bairros"}` : ""}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[26px] font-black text-brand-cream">
              Peça agora: <span className="text-brand-gold">{WHATSAPP}</span>
            </p>
            <p suppressHydrationWarning className="text-[15px] font-medium text-brand-cream/35">
              Valores atualizados em {atualizado} · sujeitos a alteração
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
