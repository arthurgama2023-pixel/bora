import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import {
  DEFAULT_PRICING,
  effectiveProductsForCity,
  getPrimaryCompanyId,
  getSitePricing,
  type Prod,
} from "@/server/services/site-pricing";

// Precisa do Node (lê o banco via prisma em getSitePricing) — não é edge.
export const runtime = "nodejs";
// A tabela muda quando o dono edita os preços na aba: nunca servir versão velha.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Cartão de preços 1080x1350 (4:5, formato de imagem do WhatsApp) que o agente
// de IA manda quando o cliente pergunta preço. Os valores vêm da MESMA fonte
// que o agente cota (getSitePricing + effectiveProductsForCity), então a
// imagem nunca "descola" do que o Lucas fala no chat — mudou o preço na aba
// "Preços do Site", a imagem muda sozinha na próxima vez que for gerada.
// ---------------------------------------------------------------------------

const WHATSAPP = "(21) 99376-5465";
const PEDIDO_MINIMO = 150;

const BRAND_BLACK = "#161616";
const CARD_BG = "#131313";
const CREAM = "#f7e9c0";
const GOLD = "#e7b424";
const AMBER = "#f3a712";

// Cor da marca (selo da litragem) por tag do produto — espelha ss-chopp/brands.ts.
const BRAND_COLOR: Record<string, string> = {
  belco: "#e01f27",
  brahma: "#e2231a",
  heineken: "#0a8537",
  amstel: "#c81f2b",
  vinho: "#6d1f63",
};

function brandColor(tag: string): string {
  return BRAND_COLOR[tag.trim().toLowerCase()] ?? "#555555";
}

function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

// "Belco 50L" -> { nome: "Belco", litros: "50L" }. Separa a litragem pra virar
// selo colorido, como no cartão do site.
function splitLitros(name: string): { nome: string; litros: string | null } {
  const m = name.match(/^(.*?)[\s]*([0-9]+\s*L)\s*$/i);
  if (m) return { nome: m[1].trim(), litros: m[2].replace(/\s+/g, "").toUpperCase() };
  return { nome: name, litros: null };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const cidade = params.get("cidade") ?? ""; // nome da ZONA (ex.: "Baixada Fluminense")
  const bairro = params.get("bairro") ?? "";
  // A imagem NUNCA pode estourar 500: se o banco der um soluço na leitura dos
  // preços, cai na tabela padrão (que espelha a oficial atual). Um cliente
  // esperando a tabela no WhatsApp não pode receber um erro no lugar da imagem.
  let products: Prod[] = [];
  try {
    const companyId = params.get("company") ?? (await getPrimaryCompanyId());
    const pricing = companyId ? await getSitePricing(companyId) : DEFAULT_PRICING;
    products = effectiveProductsForCity(pricing, cidade).filter((p) => !p.id.startsWith("kit"));
  } catch (e) {
    console.error("[tabela-precos] falha ao ler preços, usando tabela padrão:", e);
    products = DEFAULT_PRICING.products.filter((p) => !p.id.startsWith("kit"));
  }

  // Rótulo da localidade: "XERÉM · BAIXADA FLUMINENSE" (ou só a zona).
  const local = [bairro, cidade].filter(Boolean).join(" · ").toUpperCase() || "SUA REGIÃO";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1350px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: CARD_BG,
          color: CREAM,
          fontFamily: "sans-serif",
        }}
      >
        {/* ---- Cabeçalho ---- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "40px 56px",
            borderBottom: `6px solid ${GOLD}`,
            backgroundColor: "#1b1b1b",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "6px",
                color: GOLD,
              }}
            >
              SS-CHOPP DISTRIBUIDORA
            </div>
            <div style={{ fontSize: "64px", fontWeight: 800, color: CREAM, lineHeight: 1.05 }}>
              TABELA DE PREÇOS
            </div>
            <div style={{ fontSize: "22px", color: "#b8ad8f" }}>
              Chopp gelado entregue na sua festa
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              border: `1px solid ${GOLD}55`,
              borderRadius: "18px",
              backgroundColor: "#00000066",
              padding: "16px 22px",
            }}
          >
            <div style={{ fontSize: "16px", letterSpacing: "3px", color: "#b8ad8f" }}>
              PEDIDOS NO ZAP
            </div>
            <div style={{ fontSize: "34px", fontWeight: 800, color: CREAM }}>{WHATSAPP}</div>
          </div>
        </div>

        {/* ---- Faixa da localidade ---- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 56px",
            background: `linear-gradient(90deg, ${AMBER}, ${GOLD})`,
          }}
        >
          <div style={{ fontSize: "40px", fontWeight: 800, color: BRAND_BLACK }}>{local}</div>
          <div
            style={{
              display: "flex",
              backgroundColor: BRAND_BLACK,
              color: GOLD,
              fontSize: "26px",
              fontWeight: 800,
              borderRadius: "999px",
              padding: "10px 26px",
            }}
          >
            FRETE GRÁTIS
          </div>
        </div>

        {/* ---- Cabeçalho das colunas ---- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "18px 56px",
            borderBottom: "1px solid #ffffff1a",
            backgroundColor: "#ffffff0a",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "2px",
            color: "#a99f82",
          }}
        >
          <div style={{ display: "flex", flex: 1, color: "#a99f82" }}>BARRIL</div>
          <div style={{ display: "flex", width: "180px", justifyContent: "center", color: "#a99f82" }}>
            1 BARRIL
          </div>
          <div style={{ display: "flex", width: "180px", justifyContent: "center", color: "#a99f82" }}>
            2 BARRIS
          </div>
          <div style={{ display: "flex", width: "210px", justifyContent: "center", color: GOLD }}>
            3+ BARRIS
          </div>
        </div>

        {/* ---- Linhas ---- */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {products.map((p, i) => {
            const { nome, litros } = splitLitros(p.name);
            const cor = brandColor(p.tag);
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  padding: "0 56px",
                  backgroundColor: i % 2 ? "#ffffff08" : "transparent",
                  borderTop: i ? "1px solid #ffffff12" : "none",
                }}
              >
                {/* nome + selo de litragem */}
                <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
                  <div style={{ fontSize: "38px", fontWeight: 800, color: CREAM }}>{nome}</div>
                  {litros ? (
                    <div
                      style={{
                        display: "flex",
                        marginLeft: "16px",
                        backgroundColor: cor,
                        color: "#ffffff",
                        fontSize: "24px",
                        fontWeight: 800,
                        borderRadius: "12px",
                        padding: "4px 14px",
                      }}
                    >
                      {litros}
                    </div>
                  ) : null}
                </div>

                {/* preços */}
                {p.tiers ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        width: "180px",
                        justifyContent: "center",
                        fontSize: "32px",
                        fontWeight: 700,
                        color: "#d8cfb2",
                      }}
                    >
                      {brl(p.tiers[0])}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        width: "180px",
                        justifyContent: "center",
                        fontSize: "32px",
                        fontWeight: 700,
                        color: "#d8cfb2",
                      }}
                    >
                      {brl(p.tiers[1])}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      width: "360px",
                      justifyContent: "center",
                      fontSize: "22px",
                      color: "#8f866c",
                    }}
                  >
                    preço único · qualquer qtd.
                  </div>
                )}

                <div style={{ display: "flex", width: "210px", justifyContent: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      minWidth: "180px",
                      border: `1px solid ${GOLD}77`,
                      backgroundColor: `${GOLD}26`,
                      borderRadius: "14px",
                      padding: "10px 0",
                      fontSize: "36px",
                      fontWeight: 800,
                      color: GOLD,
                    }}
                  >
                    {brl(p.tiers ? p.tiers[2] : (p.fixed ?? 0))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- Rodapé ---- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 56px",
            borderTop: `6px solid ${GOLD}`,
            backgroundColor: "#1b1b1b",
            fontSize: "22px",
            color: "#c8bd9c",
          }}
        >
          <div style={{ display: "flex" }}>
            Preço por barril · frete grátis na região · pedido mínimo {brl(PEDIDO_MINIMO)}
          </div>
          <div style={{ display: "flex", fontWeight: 700, color: GOLD }}>{WHATSAPP}</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
