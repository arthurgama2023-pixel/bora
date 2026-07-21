"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ServiceRow {
  id: string;
  name: string;
  durationMin: number;
  description: string | null;
  price: number | null;
  active: boolean;
}

interface CompanyData {
  id: string;
  name: string;
  agentName: string;
  welcomeMessage: string | null;
  timezone: string;
  workdayStart: number;
  workdayEnd: number;
  defaultDurMin: number;
  services: ServiceRow[];
}

interface WppStatus {
  configured: boolean;
  state: "open" | "connecting" | "close" | "unknown";
  qrBase64?: string;
  pairingCode?: string;
  number?: string;
  publicUrlWarning?: boolean;
}

const input =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white";
const btn =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50";
const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";

const TIMEZONES = [
  ["America/Sao_Paulo", "Brasília (São Paulo)"],
  ["America/Manaus", "Manaus"],
  ["America/Cuiaba", "Cuiabá"],
  ["America/Rio_Branco", "Rio Branco"],
];

// Etapas do assistente de configuração inicial (só aparece na 1ª vez, até concluir).
const WIZARD_STEPS = ["Configuração da Empresa", "Serviços", "WhatsApp", "Google Agenda"];

// Onde guardamos o passo atual do assistente. Necessário porque o wizardStep é
// estado efêmero de React: qualquer remontagem do componente (re-render do
// /empresa, redirect do OAuth Google, reload, hydration mismatch de extensão)
// reinicializa `useState(initialCompany ? null : 1)` para null quando a empresa
// já existe — e o assistente "volta" sozinho para o painel completo.
const SETUP_KEY = "agendaai.empresa.setupStep";

function WizardProgress({ step, onBack }: { step: number; onBack?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="font-medium text-zinc-600">
          Passo {step} de {WIZARD_STEPS.length}
        </span>
        <span>·</span>
        <span>{WIZARD_STEPS[step - 1]}</span>
      </div>
      {onBack && (
        <button type="button" onClick={onBack} className="text-xs font-medium text-zinc-400 hover:text-zinc-600 hover:underline">
          ← Voltar
        </button>
      )}
    </div>
  );
}

function WizardNav({ onNext, nextLabel = "Próximo →" }: { onNext: () => void; nextLabel?: string }) {
  return (
    <div className="mt-4 flex justify-end border-t border-zinc-100 pt-4">
      <button type="button" onClick={onNext} className={btn}>
        {nextLabel}
      </button>
    </div>
  );
}

interface AppointmentRow {
  id: string;
  title: string;
  startsAt: string;
  clientName: string;
  serviceName: string | null;
  googleSynced: boolean;
}

// Lista dos próximos agendamentos criados pelo agente (WhatsApp ou chat de teste).
function AppointmentsList({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<AppointmentRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/empresa/agendamentos")
      .then((r) => (r.ok ? r.json() : { appointments: [] }))
      .then((d) => alive && setItems(d.appointments ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));

  return (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold">Agendamentos</h2>
      <p className="mb-3 text-xs text-zinc-400">Próximos 14 dias.</p>
      {items === null ? (
        <p className="text-xs text-zinc-400">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-400">
          Nenhum agendamento ainda. Converse com o agente ao lado (ou pelo WhatsApp) para criar um.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((a) => (
            <li key={a.id} className="py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{a.clientName}</p>
                <span className="shrink-0 text-xs font-medium text-zinc-500">{fmt(a.startsAt)}</span>
              </div>
              <p className="text-xs text-zinc-400">
                {a.serviceName ?? a.title}
                {a.googleSynced ? " · ✔ Google" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Chat de teste: o dono conversa com o próprio agente como se fosse um cliente.
// Reusa o mesmo cérebro do WhatsApp (runAttendant) — inclusive agenda de verdade.
/** Mesma renderização leve do chat do Modo Pessoal: **negrito** e quebras de linha. */
function renderChatText(text: string) {
  return text.split("\n").map((line, i) => (
    <p key={i} className="min-h-[1em]">
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={j}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </p>
  ));
}

// Mesmo design do chat do Modo Pessoal (componente Chat.tsx): header, bolhas
// com canto assimétrico, indicador de "digitando" com 3 pontinhos, input em
// pílula e botão de enviar circular. Só a lógica é diferente (agente da empresa).
function AgentTestChat({ agentName, onActivity }: { agentName: string; onActivity: () => void }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/empresa/chat")
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((d) => Array.isArray(d.history) && setMsgs(d.history))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setSending(true);
    try {
      const res = await fetch("/api/empresa/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "model", text: data.reply ?? "Algo deu errado. Tente novamente." }]);
      onActivity(); // pode ter criado um agendamento → atualiza a lista ao lado
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "model", text: "Não consegui falar com o servidor. Verifique a conexão." },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    await fetch("/api/empresa/chat", { method: "DELETE" }).catch(() => {});
    setMsgs([]);
  }

  return (
    <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">Testar o agente {agentName}</h2>
          <p className="text-xs text-zinc-400">Converse como se fosse um cliente</p>
        </div>
        {msgs.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
          >
            Limpar
          </button>
        )}
      </div>

      <div ref={scrollRef} className="chat-scroll h-72 space-y-3 overflow-y-auto px-5 py-4">
        {loaded && msgs.length === 0 && (
          <p className="pt-20 text-center text-xs text-zinc-400">
            Diga um “oi” para o agente {agentName} começar o atendimento.
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-zinc-900 text-white"
                  : "rounded-bl-md bg-zinc-100 text-zinc-800"
              }`}
            >
              {renderChatText(m.text)}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-zinc-100 px-4 py-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ex.: quero marcar um horário amanhã"
          disabled={sending}
          className="h-10 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none transition focus:border-zinc-400 focus:bg-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:opacity-40"
          aria-label="Enviar"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M3.4 20.4 20.85 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87l.01 6.53Z" />
          </svg>
        </button>
      </form>
    </section>
  );
}

// Painel de uso da empresa já configurada: chat de teste + agendamentos.
function EmpresaDashboard({
  company,
  justFinished,
  onEdit,
}: {
  company: CompanyData;
  justFinished: boolean;
  onEdit: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-4">
      {justFinished && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          🎉 Configuração concluída! Sua empresa já pode atender pelo WhatsApp.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{company.name}</h2>
          <p className="text-xs text-zinc-400">Agente {company.agentName} atendendo</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
        >
          Configurar / Editar
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AgentTestChat agentName={company.agentName} onActivity={() => setRefreshKey((k) => k + 1)} />
        <AppointmentsList refreshKey={refreshKey} />
      </div>
    </div>
  );
}

export function EmpresaPanel({
  initialCompany,
  googleConnected,
  googleAvailable,
}: {
  initialCompany: CompanyData | null;
  googleConnected: boolean;
  googleAvailable: boolean;
}) {
  const [company, setCompany] = useState<CompanyData | null>(initialCompany);

  // Assistente passo a passo: só ativo na criação (empresa nova). Quem já tem
  // empresa configurada vê o painel completo direto, sem passar pelas etapas.
  const [wizardStep, setWizardStep] = useState<number | null>(initialCompany ? null : 1);
  const [justFinished, setJustFinished] = useState(false);

  // Avança/sai do assistente persistindo o passo, para sobreviver a remontagens.
  // Toda troca de etapa passa por aqui (nunca chamar setWizardStep direto).
  const goToStep = useCallback((step: number | null) => {
    setWizardStep(step);
    if (typeof window === "undefined") return;
    if (step === null) sessionStorage.removeItem(SETUP_KEY);
    else sessionStorage.setItem(SETUP_KEY, String(step));
  }, []);

  // Retoma o assistente onde parou após uma remontagem (empresa já existente).
  useEffect(() => {
    if (!initialCompany || typeof window === "undefined") return;
    const saved = sessionStorage.getItem(SETUP_KEY);
    if (saved === null) return;
    const n = Number(saved);
    if (Number.isInteger(n) && n >= 1 && n <= WIZARD_STEPS.length) setWizardStep(n);
  }, [initialCompany]);

  // ── formulário de config (criação e edição usam os mesmos campos) ──
  const [form, setForm] = useState({
    name: initialCompany?.name ?? "",
    agentName: initialCompany?.agentName ?? "Ana",
    welcomeMessage: initialCompany?.welcomeMessage ?? "",
    timezone: initialCompany?.timezone ?? "America/Sao_Paulo",
    workdayStart: initialCompany?.workdayStart ?? 8,
    workdayEnd: initialCompany?.workdayEnd ?? 18,
    defaultDurMin: initialCompany?.defaultDurMin ?? 60,
  });
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingCfg(true);
    setCfgSaved(false);
    try {
      const res = await fetch("/api/empresa", {
        method: company ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, welcomeMessage: form.welcomeMessage || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompany((c) => ({ ...(c ?? { services: [] as ServiceRow[] }), ...data.company }));
        if (wizardStep === 1) {
          goToStep(2); // acabou de criar — avança pro próximo passo
        } else {
          setCfgSaved(true);
          setTimeout(() => setCfgSaved(false), 2500);
        }
      }
    } finally {
      setSavingCfg(false);
    }
  }

  // ── serviços ──
  const [svc, setSvc] = useState({ name: "", durationMin: 60, price: "", description: "" });
  const [addingSvc, setAddingSvc] = useState(false);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setAddingSvc(true);
    try {
      const res = await fetch("/api/empresa/servicos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: svc.name,
          durationMin: Number(svc.durationMin),
          price: svc.price ? Number(svc.price.replace(",", ".")) : null,
          description: svc.description || null,
        }),
      });
      if (res.ok) {
        const { service } = await res.json();
        setCompany({ ...company, services: [...company.services, service] });
        setSvc({ name: "", durationMin: 60, price: "", description: "" });
      }
    } finally {
      setAddingSvc(false);
    }
  }

  async function toggleService(s: ServiceRow) {
    if (!company) return;
    const res = await fetch(`/api/empresa/servicos/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    if (res.ok) {
      setCompany({
        ...company,
        services: company.services.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)),
      });
    }
  }

  async function removeService(s: ServiceRow) {
    if (!company) return;
    const res = await fetch(`/api/empresa/servicos/${s.id}`, { method: "DELETE" });
    if (res.ok) {
      setCompany({ ...company, services: company.services.filter((x) => x.id !== s.id) });
    }
  }

  // ── WhatsApp da empresa ──
  const [wpp, setWpp] = useState<WppStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshWpp = useCallback(async () => {
    const res = await fetch("/api/empresa/whatsapp");
    if (!res.ok) return;
    const data = (await res.json()) as WppStatus;
    setWpp((prev) => ({ ...prev, ...data }));
    if (data.state === "open" && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (company) refreshWpp();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [company?.id, refreshWpp]); // eslint-disable-line react-hooks/exhaustive-deps

  async function connectWpp() {
    if (phone.replace(/\D/g, "").length < 10) return;
    setConnecting(true);
    setWpp((s) => (s ? { ...s, pairingCode: undefined, qrBase64: undefined } : s));
    try {
      const res = await fetch("/api/empresa/whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number: phone }),
      });
      if (res.ok) {
        const data = (await res.json()) as WppStatus;
        setWpp(data);
        if (data.state !== "open" && !pollRef.current) {
          pollRef.current = setInterval(refreshWpp, 3000);
        }
      }
    } finally {
      setConnecting(false);
    }
  }

  // ─────────────────────────── seções (reutilizadas no assistente e no painel) ───────────────────────────

  const configCard = (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold">
        {company ? "Configuração da Empresa" : "Vamos criar sua empresa"}
      </h2>
      <form onSubmit={saveConfig} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Nome da empresa</span>
            <input className={input} required value={form.name} placeholder="Clínica Vida"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Nome do agente de IA</span>
            <input className={input} required value={form.agentName} placeholder="Maria"
              onChange={(e) => setForm({ ...form, agentName: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">Mensagem de boas-vindas (opcional)</span>
          <input className={input} value={form.welcomeMessage} placeholder="Deixe vazio para o agente se apresentar sozinho"
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-zinc-600">Fuso horário</span>
            <select className={input} value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              {TIMEZONES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Abre às</span>
            <input className={input} type="number" min={0} max={23} value={form.workdayStart}
              onChange={(e) => setForm({ ...form, workdayStart: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Fecha às</span>
            <input className={input} type="number" min={1} max={24} value={form.workdayEnd}
              onChange={(e) => setForm({ ...form, workdayEnd: Number(e.target.value) })} />
          </label>
        </div>
        <label className="block sm:w-1/2">
          <span className="text-xs font-medium text-zinc-600">Duração padrão dos serviços (min)</span>
          <input className={input} type="number" min={5} max={480} value={form.defaultDurMin}
            onChange={(e) => setForm({ ...form, defaultDurMin: Number(e.target.value) })} />
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={savingCfg} className={btn}>
            {savingCfg ? "Salvando…" : wizardStep === 1 ? "Próximo →" : "Salvar"}
          </button>
          {cfgSaved && <span className="text-xs font-medium text-emerald-600">✓ Salvo</span>}
        </div>
      </form>
    </section>
  );

  const servicesCard = (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold">Serviços</h2>
      <p className="mb-3 text-xs text-zinc-400">
        O agente usa esta lista para atender: só oferece (e agenda) o que estiver aqui e ativo.
      </p>

      {(company?.services.length ?? 0) > 0 && (
        <ul className="mb-4 divide-y divide-zinc-100">
          {company!.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${s.active ? "" : "text-zinc-400 line-through"}`}>
                  {s.name}
                </p>
                <p className="text-xs text-zinc-400">
                  {s.durationMin} min
                  {s.price != null ? ` · R$ ${s.price.toFixed(2).replace(".", ",")}` : ""}
                  {s.description ? ` · ${s.description}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => toggleService(s)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${s.active ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"}`}>
                  {s.active ? "Ativo" : "Inativo"}
                </button>
                <button onClick={() => removeService(s)} aria-label={`Excluir ${s.name}`}
                  className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-50">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addService} className="grid gap-2 sm:grid-cols-[1fr_90px_110px_1fr_auto]">
        <input className={input} required placeholder="Nome (ex.: Consulta)" value={svc.name}
          onChange={(e) => setSvc({ ...svc, name: e.target.value })} />
        <input className={input} type="number" min={5} max={480} title="Duração (min)" value={svc.durationMin}
          onChange={(e) => setSvc({ ...svc, durationMin: Number(e.target.value) })} />
        <input className={input} placeholder="R$ (opcional)" inputMode="decimal" value={svc.price}
          onChange={(e) => setSvc({ ...svc, price: e.target.value })} />
        <input className={input} placeholder="Descrição (opcional)" value={svc.description}
          onChange={(e) => setSvc({ ...svc, description: e.target.value })} />
        <button type="submit" disabled={addingSvc} className={`${btn} mt-1`}>
          {addingSvc ? "…" : "Adicionar"}
        </button>
      </form>

      {wizardStep === 2 && (
        <>
          {company?.services.length === 0 && (
            <p className="mt-3 text-xs text-zinc-400">
              Pode adicionar serviços depois também — não precisa cadastrar tudo agora.
            </p>
          )}
          <WizardNav onNext={() => goToStep(3)} />
        </>
      )}
    </section>
  );

  const whatsappCard = (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold">WhatsApp da empresa</h2>
      <p className="mb-3 text-xs text-zinc-400">
        É o número que seus clientes vão chamar — o agente {form.agentName || "de IA"} responde por ele.
      </p>

      {wpp?.state === "open" ? (
        <div className="rounded-xl bg-emerald-50 p-4 text-center">
          <p className="text-sm font-medium text-emerald-800">
            ✅ WhatsApp conectado{wpp.number ? ` — +${wpp.number}` : ""}
          </p>
          <p className="mt-1 text-xs text-emerald-700">O atendente virtual já está respondendo os clientes.</p>
          <button
            onClick={async () => {
              await fetch("/api/empresa/whatsapp", { method: "DELETE" });
              refreshWpp();
            }}
            className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Desconectar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {wpp?.pairingCode ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Código de conexão</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-indigo-700">{wpp.pairingCode}</p>
              <p className="mt-2 text-xs text-zinc-600">
                No celular do número da empresa: WhatsApp → <strong>Aparelhos conectados</strong> →{" "}
                <strong>Conectar com número de telefone</strong> → digite o código.
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">Aguardando confirmação… (atualiza sozinho)</p>
            </div>
          ) : (
            <label className="block sm:w-2/3">
              <span className="text-xs font-medium text-zinc-600">Número do WhatsApp da empresa (com DDD)</span>
              <input className={input} inputMode="tel" placeholder="(11) 99999-8888" value={phone}
                onChange={(e) => setPhone(e.target.value)} />
            </label>
          )}
          <button onClick={connectWpp} disabled={connecting || phone.replace(/\D/g, "").length < 10} className={btn}>
            {connecting ? "Gerando…" : wpp?.pairingCode ? "Gerar novo código" : "Gerar código de conexão"}
          </button>
          {wpp?.publicUrlWarning && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠️ App em localhost — para receber mensagens é preciso a URL pública (produção).
            </p>
          )}
        </div>
      )}

      {wizardStep === 3 && (
        <>
          {wpp?.state !== "open" && (
            <p className="mt-3 text-xs text-zinc-400">
              Pode conectar depois também — o código continua disponível na próxima vez que você abrir esta tela.
            </p>
          )}
          <WizardNav onNext={() => goToStep(4)} />
        </>
      )}
    </section>
  );

  const googleCard = (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold">Google Agenda da empresa</h2>
      <p className="mb-3 text-xs text-zinc-400">
        Os agendamentos feitos pelo atendente entram direto nesta agenda.
      </p>
      {googleConnected ? (
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600">
          ● Google Agenda conectado
        </span>
      ) : googleAvailable ? (
        <a href="/api/auth/google?company=1" className={`${btn} inline-block`}>
          Conectar Google Agenda
        </a>
      ) : (
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500">
          Google não configurado no servidor — agendamentos ficam só no painel
        </span>
      )}

      {wizardStep === 4 && (
        <>
          {!googleConnected && (
            <p className="mt-3 text-xs text-zinc-400">
              Pode conectar depois também — sem o Google, os agendamentos ficam só no painel.
            </p>
          )}
          <WizardNav
            nextLabel="Concluir configuração 🎉"
            onNext={() => {
              goToStep(null);
              setJustFinished(true);
              setTimeout(() => setJustFinished(false), 6000);
            }}
          />
        </>
      )}
    </section>
  );

  // ─────────────────────────── render ───────────────────────────

  // Assistente passo a passo (só na configuração inicial): revela 1 etapa por vez.
  if (wizardStep !== null) {
    return (
      <div className="space-y-4">
        <WizardProgress
          step={wizardStep}
          onBack={wizardStep > 1 ? () => goToStep(Math.max(1, wizardStep - 1)) : undefined}
        />
        {wizardStep === 1 && configCard}
        {wizardStep === 2 && servicesCard}
        {wizardStep === 3 && whatsappCard}
        {wizardStep === 4 && googleCard}
      </div>
    );
  }

  // Empresa já configurada (fluxo concluído): painel de uso — chat de teste com
  // o agente + agendamentos. A configuração fica atrás de "Configurar / Editar".
  if (!company) return null; // guarda: só ocorre se não houver empresa
  return (
    <EmpresaDashboard
      company={company}
      justFinished={justFinished}
      onEdit={() => {
        setJustFinished(false);
        goToStep(1);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );
}
