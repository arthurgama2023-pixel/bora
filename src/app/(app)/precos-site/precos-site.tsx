"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Store,
  Bot,
  SlidersHorizontal,
  Upload,
  MapPin,
  RotateCcw,
  Loader2,
  Plus,
  ListPlus,
  X,
  Save,
} from "lucide-react";
import { Badge, Button, Card, PageHeader, StatCard } from "@/components/ui";
import { REGIONS_BY_CITY } from "@/server/data/site-regions";

// ---------------------------------------------------------------------------
// Fonte única de preços + cobertura: REGIONS_BY_CITY vem de
// server/data/site-regions.ts (compartilhado com o agente de IA via
// site-pricing.ts). Persistido no Supabase; lido pelo site público
// (/api/public/site-pricing) e pelo agente do WhatsApp.
// ---------------------------------------------------------------------------

type Prod = {
  id: string;
  name: string;
  tag: string;
  emoji: string;
  tiers?: [number, number, number]; // 1un, 2un, 3+
  fixed?: number;
};

// Tabela padrão do SS-Chopp — ponto de partida de toda região.
const INITIAL: Prod[] = [
  { id: "belco-30l", name: "Belco 30L", tag: "Belco", emoji: "🛢️", tiers: [450, 400, 360] },
  { id: "belco-50l", name: "Belco 50L", tag: "Belco", emoji: "🛢️", tiers: [600, 550, 500] },
  { id: "brahma-50l", name: "Brahma 50L", tag: "Brahma", emoji: "🛢️", tiers: [950, 900, 850] },
  { id: "heineken-50l", name: "Heineken 50L", tag: "Heineken", emoji: "🛢️", tiers: [1000, 950, 900] },
  { id: "amstel-50l", name: "Amstel 50L", tag: "Amstel", emoji: "🛢️", tiers: [800, 750, 700] },
  { id: "vinho-30l", name: "Choppe de Vinho 30L", tag: "Vinho", emoji: "🍷", fixed: 450 },
  { id: "vinho-50l", name: "Choppe de Vinho 50L", tag: "Vinho", emoji: "🍷", fixed: 600 },
  { id: "kit-chopeira", name: "Chopeira Completa (diária)", tag: "Promoção", emoji: "🧊", fixed: 120 },
  { id: "kit-extracao", name: "Kit Extração + Mesa", tag: "Equip.", emoji: "⚙️", fixed: 85 },
];

type City = { city: string; n: number; eta: string };

// Bairros OFICIAIS de cada zona do Rio (fonte: Wikipédia/divisão administrativa)
// que ainda NÃO foram adicionados. Aparecem como sugestão pra o usuário
// aprovar um por um (ou aprovar todos de uma vez) — não entram sozinhos.
// "Benfica" e "Mangueira" aparecem tanto em Centro quanto em Zona Norte nas
// fontes oficiais (bairros de fronteira) — mantidos nas duas por fidelidade
// à fonte, não é erro de digitação.
const SUGGESTIONS_BY_ZONE: Record<string, string[]> = {
  "Zona Sul": [
    "Botafogo", "Catete", "Copacabana", "Cosme Velho", "Flamengo", "Gávea",
    "Humaitá", "Ipanema", "Jardim Botânico", "Lagoa", "Laranjeiras", "Leblon",
    "Leme", "Rocinha", "São Conrado", "Urca", "Vidigal",
  ],
  "Centro": [
    "Benfica", "Caju", "Catumbi", "Centro", "Cidade Nova", "Estácio", "Gamboa",
    "Glória", "Lapa", "Mangueira", "Paquetá", "Rio Comprido", "Santa Teresa",
    "Santo Cristo", "São Cristóvão", "Saúde", "Vasco da Gama",
  ],
  "Zona Oeste": [
    "Bangu", "Barra de Guaratiba", "Campo dos Afonsos", "Campo Grande",
    "Cosmos", "Deodoro", "Gericinó", "Guaratiba", "Ilha de Guaratiba",
    "Inhoaíba", "Jabour", "Jardim Sulacap", "Magalhães Bastos", "Paciência",
    "Padre Miguel", "Pedra de Guaratiba", "Realengo", "Santa Cruz",
    "Santíssimo", "Senador Camará", "Senador Vasconcelos", "Sepetiba",
    "Vila Kennedy", "Vila Militar",
  ],
  // Os outros 79 bairros oficiais da Zona Norte (10 já cadastrados: Brás de
  // Pina, Cordovil, Parada de Lucas, Penha, Vista Alegre, Olaria, Ramos,
  // Vila da Penha, Vicente de Carvalho, Vigário Geral).
  "Zona Norte": [
    "Abolição", "Acari", "Água Santa", "Alto da Boa Vista", "Anchieta",
    "Andaraí", "Argentino", "Bancários", "Barros Filho", "Benfica",
    "Bento Ribeiro", "Bonsucesso", "Cachambi", "Cacuia", "Campinho",
    "Cascadura", "Cavalcanti", "Cidade Universitária", "Cocotá",
    "Coelho Neto", "Colégio", "Complexo do Alemão", "Costa Barros",
    "Del Castilho", "Encantado", "Engenheiro Leal", "Engenho da Rainha",
    "Engenho de Dentro", "Engenho Novo", "Freguesia", "Galeão", "Grajaú",
    "Guadalupe", "Higienópolis", "Honório Gurgel", "Inhaúma", "Irajá",
    "Jacaré", "Jacarezinho", "Jardim América", "Jardim Carioca",
    "Jardim Guanabara", "Lins de Vasconcelos", "Madureira", "Mangueira",
    "Manguinhos", "Maracanã", "Maré", "Marechal Hermes", "Maria da Graça",
    "Méier", "Moneró", "Oswaldo Cruz", "Parque Anchieta", "Parque Colúmbia",
    "Pavuna", "Penha Circular", "Piedade", "Pilares", "Pitangueiras",
    "Portuguesa", "Praça da Bandeira", "Praia da Bandeira",
    "Quintino Bocaiuva", "Riachuelo", "Ribeira", "Ricardo de Albuquerque",
    "Rocha", "Rocha Miranda", "Sampaio", "São Francisco Xavier", "Tauá",
    "Tijuca", "Todos os Santos", "Tomás Coelho", "Turiaçu", "Vaz Lobo",
    "Vila Isabel", "Vila Kosmos",
  ],
};

const CITY_META: { city: string; eta: string }[] = [
  { city: "Baixada Fluminense", eta: "1 a 2 dias" },
  { city: "Zona Norte", eta: "1 a 2 dias" },
  { city: "Zona Sul", eta: "1 a 2 dias" },
  { city: "Centro", eta: "1 a 2 dias" },
  { city: "Zona Oeste", eta: "1 a 2 dias" },
];

const CITIES: City[] = CITY_META.map((m) => ({
  ...m,
  n: REGIONS_BY_CITY[m.city].length,
}));

// normaliza p/ busca tolerante a acento/caixa
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Promo = { icon: string; name: string; desc: string; sched: string; on: boolean };
const PROMOS: Promo[] = [
  { icon: "🔥", name: "Oferta por tempo limitado", desc: "Banner + contagem regressiva até a meia-noite no site. Gera urgência sem baixar preço.", sched: "Todos os dias · zera 00:00", on: true },
  { icon: "📦", name: "Combo Fim de Semana", desc: "Destaca a faixa 3+ (menor preço) de sexta a domingo. Aproveita o escalonamento que já existe.", sched: "Sex–Dom", on: true },
  { icon: "🍻", name: "Happy Hour do Chopp", desc: "Preço especial em dias/horários fracos (ex.: seg a qui). Some sozinho fora da janela.", sched: "Seg–Qui · 14h às 18h", on: false },
  { icon: "🎉", name: "Data comemorativa", desc: "Preço com início e fim marcados: Carnaval, Copa, Réveillon, Dia dos Pais.", sched: "Agenda início → fim", on: false },
  { icon: "🎁", name: "Primeira compra", desc: "Brinde de boas-vindas (gelo/copos) para quem compra pela 1ª vez. Cruza com o CRM.", sched: "Gatilho: cliente novo", on: false },
  { icon: "💛", name: "Cliente fiel", desc: "Desconto de recompra para quem já pediu antes — o KegControl já sabe quem é.", sched: "Gatilho: 2ª compra +", on: false },
];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fromPrice = (p: Prod) => (p.fixed != null ? p.fixed : Math.min(...p.tiers!));

export function PrecosSite() {
  // Tabela padrão do SS-Chopp — ponto de partida de toda região. Carregada do
  // servidor (fonte única no Supabase) ao abrir; começa com o default local.
  const [prods, setProds] = useState<Prod[]>(INITIAL);
  const [promos, setPromos] = useState<Promo[]>(PROMOS);
  const [toast, setToast] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Preços por região: cada cidade pode sobrescrever a tabela padrão.
  // Sem override => segue o padrão. `resetNonce` força o form a remontar ao
  // trocar de região ou voltar ao padrão (inputs não-controlados).
  const [overrides, setOverrides] = useState<Record<string, Prod[]>>({});
  const [region, setRegion] = useState(CITIES[0].city);
  const [resetNonce, setResetNonce] = useState(0);

  // Bairros adicionados além dos já embutidos, por cidade — PERSISTIDO no
  // servidor junto com os preços. É isso que faz o bairro novo passar a valer
  // de verdade no site (o site funde REGIONS_BY_CITY + extraRegions).
  const [extraRegions, setExtraRegions] = useState<Record<string, string[]>>({});
  // Bairros EMBUTIDOS (REGIONS_BY_CITY) que foram excluídos por cidade —
  // também PERSISTIDO. É o que faz um bairro embutido sumir de verdade do
  // site (o site funde REGIONS_BY_CITY − removedRegions + extraRegions).
  const [removedRegions, setRemovedRegions] = useState<Record<string, string[]>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");

  // Cobertura efetiva: embutidos de pé (descontando excluídos) + adicionados.
  const regions: City[] = CITIES.map((c) => ({
    ...c,
    n: builtInStanding(c.city).length + (extraRegions[c.city]?.length ?? 0),
  }));

  const activePromos = promos.filter((p) => p.on).length;
  const customRegions = Object.keys(overrides).length;

  const cloneBase = () =>
    prods.map((p) => ({ ...p, tiers: p.tiers ? ([...p.tiers] as [number, number, number]) : undefined }));
  const effFor = (city: string) => overrides[city] ?? prods;
  const isCustom = (city: string) => !!overrides[city];

  function setRegionPrice(city: string, id: string, i: number, val: number) {
    setOverrides((prev) => {
      const cur = prev[city] ?? cloneBase();
      const next = cur.map((p) => {
        if (p.id !== id) return p;
        if (p.fixed != null) return { ...p, fixed: val };
        const tiers = [...p.tiers!] as [number, number, number];
        tiers[i] = val;
        return { ...p, tiers };
      });
      return { ...prev, [city]: next };
    });
  }

  function resetRegion(city: string) {
    setOverrides((prev) => {
      const n = { ...prev };
      delete n[city];
      return n;
    });
    setResetNonce((x) => x + 1);
  }

  const totalRegions = regions.reduce((a, c) => a + c.n, 0);

  // Adiciona um bairro/localidade a uma cidade (persistido em extraRegions).
  // Ignora vazio e o que já está coberto (embutido OU já adicionado antes).
  function addRegion(city: string, name: string) {
    // Se vier mais de um nome junto (colou uma lista e apertou Enter direto),
    // reconhece como lote em vez de tentar adicionar uma linha só.
    const names = parseBulk(name);
    if (names.length > 1) {
      const added = addRegionsBulk(city, names);
      setAddName("");
      setQuickAdd("");
      fireBulkResult(added, names.length, city);
      return;
    }
    const clean = name.trim();
    const added = addRegionsBulk(city, [name]);
    if (added > 0) {
      setAddName("");
      fire(`“${clean}” adicionado a ${city} — clique em Publicar para valer no site`);
    }
  }

  function fireBulkResult(added: number, total: number, city: string) {
    const skipped = total - added;
    fire(
      `${added} ${added === 1 ? "bairro adicionado" : "bairros adicionados"} a ${city}` +
        (skipped > 0 ? ` (${skipped} já ${skipped === 1 ? "estava coberto" : "estavam cobertos"})` : "") +
        " — clique em Publicar para valer no site",
    );
  }

  // Nomes embutidos (REGIONS_BY_CITY) que ainda estão de pé nesta cidade —
  // ou seja, descontando quem foi excluído.
  function builtInStanding(city: string): string[] {
    const removed = new Set((removedRegions[city] ?? []).map(norm));
    return (REGIONS_BY_CITY[city] ?? []).filter((b) => !removed.has(norm(b)));
  }

  // Cobertura efetiva de uma cidade: embutidos de pé + adicionados.
  function coveredFor(city: string): string[] {
    return [...builtInStanding(city), ...(extraRegions[city] ?? [])];
  }

  // Adiciona vários nomes de uma vez (colar em massa). Aceita nomes separados
  // por vírgula, ponto e vírgula ou quebra de linha. Se o nome já foi um
  // bairro embutido EXCLUÍDO antes, restaura em vez de duplicar. Retorna
  // quantos entraram/voltaram (para feedback ao usuário).
  function addRegionsBulk(city: string, names: string[]): number {
    const already = extraRegions[city] ?? [];
    const removedNow = new Set((removedRegions[city] ?? []).map(norm));
    const builtinAll = new Set((REGIONS_BY_CITY[city] ?? []).map(norm));
    const covered = new Set(coveredFor(city).map(norm));
    const fresh: string[] = [];
    const restore: string[] = [];
    for (const raw of names) {
      const clean = raw.trim();
      if (!clean) continue;
      const key = norm(clean);
      if (covered.has(key)) continue;
      covered.add(key);
      if (removedNow.has(key) && builtinAll.has(key)) restore.push(clean);
      else fresh.push(clean);
    }
    if (restore.length > 0) {
      const restoreKeys = new Set(restore.map(norm));
      setRemovedRegions((prev) => ({
        ...prev,
        [city]: (prev[city] ?? []).filter((b) => !restoreKeys.has(norm(b))),
      }));
    }
    if (fresh.length > 0) {
      setExtraRegions((prev) => ({ ...prev, [city]: [...already, ...fresh] }));
    }
    return fresh.length + restore.length;
  }

  // Exclui um bairro da cobertura da cidade. Se é embutido, marca como
  // removido (persistido); se foi adicionado por aqui, tira de extraRegions.
  function removeRegion(city: string, name: string) {
    const isExtra = (extraRegions[city] ?? []).some((b) => norm(b) === norm(name));
    if (isExtra) {
      setExtraRegions((prev) => ({
        ...prev,
        [city]: (prev[city] ?? []).filter((b) => norm(b) !== norm(name)),
      }));
    } else {
      setRemovedRegions((prev) => {
        const cur = prev[city] ?? [];
        if (cur.some((b) => norm(b) === norm(name))) return prev;
        return { ...prev, [city]: [...cur, name] };
      });
    }
    fire(`“${name}” excluído de ${city} — clique em Publicar para valer no site`);
  }

  function parseBulk(text: string): string[] {
    return text
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function submitBulk() {
    const names = parseBulk(bulkText);
    if (names.length === 0) return;
    const added = addRegionsBulk(region, names);
    fireBulkResult(added, names.length, region);
    setBulkText("");
    setShowBulk(false);
  }

  function togglePromo(i: number) {
    setPromos((prev) => prev.map((p, idx) => (idx === i ? { ...p, on: !p.on } : p)));
  }

  function fire(msg: string) {
    setToast(msg);
    window.clearTimeout((fire as unknown as { _t?: number })._t);
    (fire as unknown as { _t?: number })._t = window.setTimeout(() => setToast(null), 2600);
  }

  // Carrega os preços salvos (fonte única no servidor) ao abrir a tela.
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/precos-site")
      .then((r) => r.json())
      .then((json) => {
        if (!alive || !json?.ok) return;
        const d = json.data;
        if (Array.isArray(d.products) && d.products.length) setProds(d.products);
        if (d.overrides && typeof d.overrides === "object") setOverrides(d.overrides);
        if (d.extraRegions && typeof d.extraRegions === "object") setExtraRegions(d.extraRegions);
        if (d.removedRegions && typeof d.removedRegions === "object") setRemovedRegions(d.removedRegions);
        if (Array.isArray(d.promos) && d.promos.length) setPromos(d.promos);
        setResetNonce((x) => x + 1); // remonta a tabela com os valores carregados
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  function currentPayload() {
    return { products: prods, overrides, extraRegions, removedRegions, promos };
  }

  // "Salvar" — grava o rascunho. NÃO afeta o site nem o agente; é seguro
  // salvar no meio de uma edição sem medo de publicar sem querer.
  async function saveDraft() {
    setSavingDraft(true);
    try {
      const res = await fetch("/api/v1/precos-site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPayload()),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "Falha ao salvar");
      fire("Rascunho salvo — o site ainda não mudou");
    } catch {
      fire("Erro ao salvar. Tente novamente.");
    } finally {
      setSavingDraft(false);
    }
  }

  // "Publicar no site" — grava no ao vivo. O site e o agente passam a usar
  // esses preços e bairros na hora.
  async function publish() {
    setPublishing(true);
    try {
      const res = await fetch("/api/v1/precos-site/publish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPayload()),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "Falha ao publicar");
      fire("Publicado — o site e o agente já usam esses preços e bairros");
    } catch {
      fire("Erro ao publicar. Tente novamente.");
    } finally {
      setPublishing(false);
    }
  }

  const regionInfo = regions.find((c) => c.city === region)!;
  const regionProds = effFor(region);
  const priceInput =
    "w-[84px] rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm font-semibold tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

  return (
    <>
      <PageHeader
        title="Preços do Site"
        subtitle="Fonte única dos preços do SS-Chopp: preços por região e promoções. Salvar guarda seu rascunho; Publicar no site coloca no ar de verdade."
        actions={
          <>
            <Button variant="outline" onClick={saveDraft} disabled={savingDraft || publishing || !loaded}>
              {savingDraft ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Salvar
                </>
              )}
            </Button>
            <Button onClick={publish} disabled={publishing || savingDraft || !loaded}>
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Publicando…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Publicar no site
                </>
              )}
            </Button>
          </>
        }
      />

      {/* fluxo / fonte única */}
      <Card className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4 text-brand-strong" /> Preços do Site
          <ArrowRight className="h-4 w-4 text-brand-strong" />
          <Store className="h-4 w-4 text-brand-strong" /> Site ss-chopp
          <ArrowRight className="h-4 w-4 text-brand-strong" />
          <Bot className="h-4 w-4 text-brand-strong" /> Agente WhatsApp
        </div>
        <p className="ml-auto text-xs text-muted-foreground">
          Hoje esses preços vivem copiados em 3 arquivos. Aqui viram um só.
        </p>
      </Card>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Produtos" value={prods.length} accent />
        <StatCard label="Regiões cobertas" value={totalRegions} hint={`${regions.length} cidades`} />
        <StatCard label="Promoções ativas" value={activePromos} hint={`de ${promos.length}`} />
        <StatCard label="Frete" value="Grátis" hint="em todas as regiões" />
      </div>

      {/* 1 · PREÇOS POR REGIÃO */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">1 · Preços por região</h2>
        <div className="flex items-center gap-2">
          <Badge tone={customRegions ? "brand" : "neutral"}>
            {customRegions
              ? `${customRegions} ${customRegions > 1 ? "regiões" : "região"} com preço próprio`
              : "todas no preço padrão"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar região
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowAdd(true); setShowBulk((v) => !v); }}>
            <ListPlus className="h-3.5 w-3.5" /> Adicionar bairros da zona ({region})
          </Button>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Escolha uma região e edite a tabela inteira dela. O que você mudar aqui vale para <b>todos os bairros daquela região</b>. Cada região parte da tabela padrão do SS-Chopp; você ajusta só as que quiser.
      </p>

      {showAdd && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Cidade</label>
              <select
                value={region}
                onChange={(e) => { setRegion(e.target.value); setAddName(""); setQuickAdd(""); }}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              >
                {regions.map((c) => (
                  <option key={c.city} value={c.city}>{c.city}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Buscar ou adicionar bairro</label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addRegion(region, addName); }}
                placeholder={`Digite para filtrar as ${regions.find((r) => r.city === region)?.n ?? 0} regiões…`}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          {showBulk && (
            <div className="mt-3 rounded-lg border border-brand/40 bg-brand/5 p-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Colar vários bairros da zona <b className="text-foreground">{region}</b> de uma vez — um por linha (ou separados por vírgula)
              </label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={4}
                placeholder={`Ex.:\nImbariê\nParada Angélica\nJardim Anhangá`}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={submitBulk} disabled={!bulkText.trim()}>
                  <ListPlus className="h-3.5 w-3.5" /> Adicionar todos a {region}
                </Button>
              </div>
            </div>
          )}

          {(() => {
            const covered = coveredFor(region);
            const q = norm(addName);
            const filtered = q ? covered.filter((b) => norm(b).includes(q)) : covered;
            const exact = covered.some((b) => norm(b) === q);
            return (
              <div className="mt-3">
                <div className="mb-1.5 text-xs text-muted-foreground">
                  {region} · <b className="text-foreground">{covered.length}</b>{" "}
                  {covered.length > 1 ? "regiões cobertas" : "região coberta"}
                  {q && ` · ${filtered.length} no filtro`}
                </div>
                <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border bg-background p-2">
                  {filtered.map((b) => (
                    <span key={b} className="group inline-flex items-center gap-1 rounded-full bg-success/15 pl-2.5 pr-1 py-1 text-xs font-medium text-success">
                      <Check className="h-3 w-3" /> {b}
                      <button
                        onClick={() => removeRegion(region, b)}
                        aria-label={`Excluir ${b}`}
                        className="ml-0.5 rounded-full p-0.5 text-success/70 transition-colors hover:bg-danger/20 hover:text-danger"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {filtered.length === 0 && (
                    <span className="px-1 py-1 text-xs text-muted-foreground">
                      {q
                        ? `Nenhuma região com "${addName}".`
                        : `Nenhum bairro cadastrado ainda em ${region} — adicione abaixo.`}
                    </span>
                  )}
                  {/* Escreva direto aqui pra adicionar um bairro à lista acima. */}
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand/60 bg-brand/5 pl-2.5 pr-1 py-0.5 text-xs">
                    <Plus className="h-3 w-3 shrink-0 text-brand-strong" />
                    <input
                      value={quickAdd}
                      onChange={(e) => setQuickAdd(e.target.value)}
                      onPaste={(e) => {
                        // Cola uma lista (um bairro por linha, ou separados por
                        // vírgula/; )? Reconhece como lote e adiciona todos direto,
                        // sem precisar abrir "Adicionar em massa".
                        const text = e.clipboardData.getData("text");
                        const names = parseBulk(text);
                        if (names.length > 1) {
                          e.preventDefault();
                          const added = addRegionsBulk(region, names);
                          fireBulkResult(added, names.length, region);
                          setQuickAdd("");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addRegion(region, quickAdd);
                          setQuickAdd("");
                        }
                      }}
                      placeholder={`novo bairro em ${region}… (ou cole vários, um por linha)`}
                      size={Math.max(16, quickAdd.length + 2)}
                      className="min-w-[8rem] bg-transparent py-1 text-xs font-medium text-brand-strong outline-none placeholder:font-normal placeholder:text-muted-foreground"
                    />
                  </span>
                </div>
                {q && !exact && (
                  <button
                    onClick={() => addRegion(region, addName)}
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed border-brand px-3 py-1 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand/5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar “{addName}” a {region}
                  </button>
                )}
              </div>
            );
          })()}

          {(() => {
            const covered = coveredFor(region);
            const coveredSet = new Set(covered.map(norm));
            const pending = (SUGGESTIONS_BY_ZONE[region] ?? []).filter((b) => !coveredSet.has(norm(b)));
            if (pending.length === 0) return null;
            return (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Bairros oficiais de <b className="text-foreground">{region}</b> ainda não adicionados —{" "}
                    <b className="text-foreground">{pending.length}</b> pendente{pending.length > 1 ? "s" : ""} de aprovação
                  </div>
                  <button
                    onClick={() => {
                      const added = addRegionsBulk(region, pending);
                      fireBulkResult(added, pending.length, region);
                    }}
                    className="whitespace-nowrap text-[11px] font-semibold text-brand-strong hover:underline"
                  >
                    Aprovar todos
                  </button>
                </div>
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {pending.map((b) => (
                    <button
                      key={b}
                      onClick={() => addRegion(region, b)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand/50 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand-strong"
                    >
                      <Plus className="h-3 w-3" /> {b}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Todas as regiões de cada cidade já vêm <b>pré-selecionadas</b> (verdes = cobertas). Digite para filtrar; se não existir, aparece a opção de adicionar — ou cole vários de uma vez em <b>“Adicionar bairros da zona”</b>. Os <b>bairros oficiais pendentes</b> (tracejados) são sugestão da fonte oficial — clique para aprovar um por um, ou "Aprovar todos". Clique em <b>Publicar no site</b> (topo da página) para valer de verdade no seletor do site.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        {/* seletor de região */}
        <div className="flex flex-col gap-2">
          {regions.map((c) => {
            const active = c.city === region;
            const custom = isCustom(c.city);
            return (
              <button
                key={c.city}
                onClick={() => { setRegion(c.city); setAddName(""); setQuickAdd(""); }}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  active ? "border-brand bg-brand/10" : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <MapPin className={`h-4 w-4 shrink-0 ${active ? "text-brand-strong" : "text-muted-foreground"}`} />
                  <span>
                    <span className="block text-sm font-semibold leading-tight">{c.city}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {c.n} {c.n > 1 ? "regiões" : "região"}
                    </span>
                  </span>
                </span>
                {custom ? (
                  <Badge tone="brand">próprio</Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground">padrão</span>
                )}
              </button>
            );
          })}
        </div>

        {/* tabela da região selecionada */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4 text-brand-strong" /> {region}
                {isCustom(region) ? (
                  <Badge tone="brand">preço próprio</Badge>
                ) : (
                  <Badge tone="neutral">seguindo padrão</Badge>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {regionInfo.n === 0
                  ? `Ainda sem bairro cadastrado em ${region} — use "Adicionar região" para escolher`
                  : `Vale para as ${regionInfo.n} ${regionInfo.n > 1 ? "regiões" : "região"} de ${region} · entrega ${regionInfo.eta} · frete grátis`}
              </div>
            </div>
            {isCustom(region) && (
              <Button variant="outline" size="sm" onClick={() => resetRegion(region)}>
                <RotateCcw className="h-3.5 w-3.5" /> Voltar ao padrão
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table key={`${region}-${resetNonce}`} className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Produto</th>
                  <th className="px-3 py-3 text-right font-semibold">1 un</th>
                  <th className="px-3 py-3 text-right font-semibold">2 un</th>
                  <th className="px-3 py-3 text-right font-semibold">3+ un</th>
                  <th className="px-4 py-3 text-right font-semibold">A partir de</th>
                </tr>
              </thead>
              <tbody>
                {regionProds.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{p.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{p.id}</div>
                    </td>
                    {p.fixed != null ? (
                      <td className="px-3 py-2.5 text-right" colSpan={3}>
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={p.fixed}
                          onChange={(e) => setRegionPrice(region, p.id, 0, parseFloat(e.target.value.replace(",", ".")) || 0)}
                          className={priceInput}
                        />
                        <span className="ml-2 text-[11px] text-muted-foreground">preço único</span>
                      </td>
                    ) : (
                      ([0, 1, 2] as const).map((i) => (
                        <td key={i} className="px-3 py-2.5 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            defaultValue={p.tiers![i]}
                            onChange={(e) => setRegionPrice(region, p.id, i, parseFloat(e.target.value.replace(",", ".")) || 0)}
                            className={priceInput}
                          />
                        </td>
                      ))
                    )}
                    <td className="px-4 py-2.5 text-right font-bold text-success tabular-nums">
                      {brl(fromPrice(p))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        Edite os preços de uma região para atender preço de concorrência ou custo de entrega mais alto sem mexer nas outras. <b>Voltar ao padrão</b> descarta os preços próprios e a região volta a seguir a tabela padrão.
      </p>

      {/* 2 · PROMOÇÕES */}
      <h2 className="mt-10 mb-1 text-lg font-semibold">2 · Promoções programadas</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Ligue/desligue e agende. A promoção ativa aparece no site (banner + contagem) e o agente passa a oferecer.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {promos.map((pr, i) => (
          <Card key={pr.name} className={`flex flex-col gap-2 p-4 ${pr.on ? "border-brand/50" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{pr.icon}</span>
                <h3 className="font-semibold leading-tight">{pr.name}</h3>
              </div>
              <button
                role="switch"
                aria-checked={pr.on}
                aria-label={`Ativar ${pr.name}`}
                onClick={() => togglePromo(i)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${pr.on ? "bg-brand" : "bg-muted-foreground/30"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${pr.on ? "left-0.5 translate-x-5" : "left-0.5"}`} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{pr.desc}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
                🗓️ {pr.sched}
              </span>
              <span className={`text-[11px] font-bold uppercase ${pr.on ? "text-success" : "text-muted-foreground"}`}>
                {pr.on ? "● No ar" : "○ Ideia"}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <b className="text-foreground">Como funciona:</b> <b>Salvar</b> guarda seu rascunho no Supabase — dá pra fechar e continuar depois, sem mexer no que está no ar. <b>Publicar no site</b> copia o rascunho pro ao vivo — aí o site do SS-Chopp e o agente do WhatsApp passam a usar na hora, sem precisar republicar o site.
      </p>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-[#1b1712] px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <Check className="h-4 w-4 text-brand" /> {toast}
        </div>
      )}
    </>
  );
}
