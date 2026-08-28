import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import {
  DEFAULT_PRICING,
  effectiveProductsForCity,
  getPrimaryCompanyId,
  getSitePricing,
  type Prod,
} from "@/server/services/site-pricing";
import { getTableBackground } from "@/server/services/table-appearance";

// Precisa do Node (lê o banco via prisma + lê as imagens dos barris do disco).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Cartão de preços 1080x1920 (9:16, formato de story/WhatsApp) que o agente de
// IA manda quando o cliente pergunta preço. Estilo FIEL ao flyer oficial da
// SS-Chopp: fundo escuro industrial, brasão, blocos por MARCA (com 30/50 LITROS),
// colunas por quantidade (1 / 2 / 3+ barris) e "CADA BARRIL". Os VALORES vêm da
// MESMA fonte que o agente cota (getSitePricing) — mudou o preço na aba, a
// imagem muda sozinha. SEM telefone (o cliente já está no WhatsApp).
// ---------------------------------------------------------------------------

const GOLD = "#e7b424";
const AMBER = "#f3a712";
const CREAM = "#f7e9c0";
const DARK = "#0c0c0c";
const PANEL = "rgba(18,18,18,0.72)";
const LINE = "rgba(231,180,36,0.25)";

const BRAND_COLOR: Record<string, string> = {
  Belco: "#e01f27",
  Brahma: "#e2231a",
  Heineken: "#0a8537",
  Amstel: "#c81f2b",
  Vinho: "#7a2470",
};

// Ordem e agrupamento das marcas, igual ao flyer.
const BRANDS: { tag: string; label: string; ids: string[] }[] = [
  { tag: "Belco", label: "Belco", ids: ["belco-30l", "belco-50l"] },
  { tag: "Brahma", label: "Brahma", ids: ["brahma-50l"] },
  { tag: "Heineken", label: "Heineken", ids: ["heineken-50l"] },
  { tag: "Amstel", label: "Amstel", ids: ["amstel-50l"] },
  { tag: "Vinho", label: "Chopp de Vinho", ids: ["vinho-30l", "vinho-50l"] },
];

const KEG_FILE: Record<string, string> = {
  Belco: "belco.png",
  Brahma: "brahma.png",
  Heineken: "heineken.png",
  Amstel: "amstel.png",
  Vinho: "vinho.png",
};

function kegDataUri(tag: string): string | null {
  const f = KEG_FILE[tag];
  if (!f) return null;
  try {
    const buf = readFileSync(join(process.cwd(), "public", "kegs", f));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

// "Belco 30L" / "Choppe de Vinho 50L" -> "30 LITROS"
function litrosLabel(name: string): string {
  const m = name.match(/(\d+)\s*L/i);
  return m ? `${m[1]} LITROS` : "";
}

// Uma linha de preço por litragem: [30 LITROS] e os 3 valores por coluna.
type PriceLine = { litros: string; values: [number, number, number]; tiered: boolean };

function linesForBrand(products: Prod[], ids: string[]): PriceLine[] {
  const out: PriceLine[] = [];
  for (const id of ids) {
    const p = products.find((x) => x.id === id);
    if (!p) continue;
    const values: [number, number, number] = p.tiers
      ? p.tiers
      : [p.fixed ?? 0, p.fixed ?? 0, p.fixed ?? 0];
    out.push({ litros: litrosLabel(p.name), values, tiered: !!p.tiers });
  }
  return out;
}

const COLS = ["1 BARRIL", "2 BARRIS", "3 BARRIS OU MAIS"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const cidade = params.get("cidade") ?? "";
  const bairro = params.get("bairro") ?? "";

  const companyId = params.get("company") ?? (await getPrimaryCompanyId());
  let products: Prod[] = [];
  try {
    const pricing = companyId ? await getSitePricing(companyId) : DEFAULT_PRICING;
    products = effectiveProductsForCity(pricing, cidade);
  } catch (e) {
    console.error("[tabela-precos] falha ao ler preços, usando padrão:", e);
    products = DEFAULT_PRICING.products;
  }

  // Fundo personalizado (aba "Aparência da tabela"). ?preview=1 usa o rascunho.
  let bg: { image: string | null; overlay: number } = { image: null, overlay: 55 };
  try {
    if (companyId) bg = await getTableBackground(companyId, { preview: params.get("preview") === "1" });
  } catch (e) {
    console.error("[tabela-precos] falha ao ler o fundo:", e);
  }
  const hasBg = !!bg.image;

  const local = [bairro, cidade].filter(Boolean).join(" · ").toUpperCase() || "SUA REGIÃO";

  const brands = BRANDS.map((b) => ({
    ...b,
    keg: kegDataUri(b.tag),
    color: BRAND_COLOR[b.tag] ?? "#555",
    lines: linesForBrand(products, b.ids),
  })).filter((b) => b.lines.length > 0);

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "1080px",
          height: "1920px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: DARK,
          color: CREAM,
          fontFamily: "sans-serif",
        }}
      >
        {/* Fundo industrial (imagem do dono) + escurecimento */}
        {hasBg ? (
          <img
            src={bg.image as string}
            width={1080}
            height={1920}
            style={{ position: "absolute", top: 0, left: 0, width: "1080px", height: "1920px", objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1080px",
            height: "1920px",
            backgroundColor: hasBg ? `rgba(0,0,0,${bg.overlay / 100})` : "#0c0c0c",
          }}
        />

        {/* ---- Brasão ---- */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "56px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "220px",
              height: "220px",
              borderRadius: "999px",
              border: `6px solid ${GOLD}`,
              backgroundColor: "#111",
            }}
          >
            <div style={{ display: "flex", fontSize: "52px", fontWeight: 800, color: CREAM, lineHeight: 1 }}>SS</div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: GOLD, lineHeight: 1.1 }}>CHOPP</div>
            <div style={{ fontSize: "14px", letterSpacing: "3px", color: "#b8ad8f", marginTop: "4px" }}>
              DESDE 2016
            </div>
          </div>
          <div style={{ display: "flex", fontSize: "26px", fontWeight: 800, color: CREAM, marginTop: "18px", letterSpacing: "2px" }}>
            TABELA DE PREÇOS · {local}
          </div>
        </div>

        {/* ---- Cabeçalho das colunas ---- */}
        <div style={{ display: "flex", alignItems: "flex-end", padding: "26px 44px 12px 44px" }}>
          <div style={{ display: "flex", width: "230px" }} />
          {COLS.map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                flex: 1,
                justifyContent: "center",
                margin: "0 8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  borderRadius: "12px",
                  background: `linear-gradient(90deg, ${AMBER}, ${GOLD})`,
                  color: "#161616",
                  fontSize: "26px",
                  fontWeight: 800,
                  padding: "12px 0",
                  textAlign: "center",
                }}
              >
                {c}
              </div>
            </div>
          ))}
        </div>

        {/* ---- Blocos por marca ---- */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 44px" }}>
          {brands.map((b, i) => (
            <div
              key={b.tag}
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                borderTop: i ? `1px solid ${LINE}` : "none",
              }}
            >
              {/* marca (imagem do barril + nome) */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "230px" }}>
                {b.keg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.keg} width={120} height={120} style={{ objectFit: "contain" }} />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    marginTop: "6px",
                    color: CREAM,
                    fontSize: "24px",
                    fontWeight: 800,
                    textAlign: "center",
                    borderBottom: `4px solid ${b.color}`,
                    paddingBottom: "2px",
                  }}
                >
                  {b.label}
                </div>
              </div>

              {/* 3 colunas de preço */}
              {[0, 1, 2].map((col) => (
                <div
                  key={col}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    margin: "0 8px",
                    padding: "14px 0",
                    borderRadius: "14px",
                    backgroundColor: PANEL,
                  }}
                >
                  {b.lines.map((ln, k) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        marginTop: k ? "10px" : "0",
                      }}
                    >
                      <div style={{ display: "flex", fontSize: "18px", letterSpacing: "1px", color: "#c9bf9f" }}>
                        {ln.litros}
                      </div>
                      <div style={{ display: "flex", fontSize: "42px", fontWeight: 800, color: GOLD, lineHeight: 1 }}>
                        {brl(ln.values[col])}
                      </div>
                      {ln.tiered && col > 0 ? (
                        <div style={{ display: "flex", fontSize: "15px", letterSpacing: "1px", color: "#9a916f" }}>
                          CADA BARRIL
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ---- Rodapé ---- */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 44px 40px 44px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              borderRadius: "999px",
              backgroundColor: GOLD,
              color: "#161616",
              fontSize: "26px",
              fontWeight: 800,
              padding: "12px 34px",
              letterSpacing: "1px",
            }}
          >
            TODOS ACOMPANHAM: CHOPEIRA, GÁS E COPOS
          </div>
          <div style={{ display: "flex", fontSize: "22px", color: "#b8ad8f", marginTop: "16px", letterSpacing: "2px" }}>
            VISA · MASTERCARD · ELO · PIX
          </div>
          <div style={{ display: "flex", fontSize: "56px", fontWeight: 800, color: CREAM, marginTop: "14px", letterSpacing: "1px" }}>
            FAÇA JÁ O SEU PEDIDO!
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    },
  );
}
