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

interface AppointmentRow {
  id: string;
  title: string;
  startsAt: string;
  serviceName: string | null;
  clientPhone: string;
  googleSynced: boolean;
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

const dtFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

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
        setCfgSaved(true);
        setTimeout(() => setCfgSaved(false), 2500);
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

  // ── agendamentos ──
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  useEffect(() => {
    if (!company) return;
    fetch("/api/empresa/agendamentos")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAppointments(d.appointments))
      .catch(() => {});
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────── render ───────────────────────────

  const configCard = (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold">
        {company ? "Configuração da Empresa" : "Criar minha empresa"}
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
            {savingCfg ? "Salvando…" : company ? "Salvar" : "Criar empresa"}
          </button>
          {cfgSaved && <span className="text-xs font-medium text-emerald-600">✓ Salvo</span>}
        </div>
      </form>
    </section>
  );

  if (!company) {
    return (
      <div className="space-y-4">
        {configCard}
        <p className="text-center text-xs text-zinc-400">
          Depois de criar, você cadastra os serviços, conecta o WhatsApp e o Google Agenda — em menos de 5 minutos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {configCard}

      {/* Serviços */}
      <section className={card}>
        <h2 className="mb-1 text-sm font-semibold">Serviços</h2>
        <p className="mb-3 text-xs text-zinc-400">
          O agente usa esta lista para atender: só oferece (e agenda) o que estiver aqui e ativo.
        </p>

        {company.services.length > 0 && (
          <ul className="mb-4 divide-y divide-zinc-100">
            {company.services.map((s) => (
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
      </section>

      {/* WhatsApp da empresa */}
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
      </section>

      {/* Google Agenda da empresa */}
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
      </section>

      {/* Agendamentos */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold">Próximos agendamentos (14 dias)</h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Nenhum agendamento ainda. Assim que um cliente marcar pelo WhatsApp, aparece aqui.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {appointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-zinc-400">
                    {dtFmt.format(new Date(a.startsAt))} · +{a.clientPhone}
                    {a.googleSynced ? " · ✔ Google" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
