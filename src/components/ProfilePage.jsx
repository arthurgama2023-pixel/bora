import { useState, useEffect } from "react";
import "./ProfilePage.css";
import { API, authFetch } from "../api";

const BORA_PROMPT = `Você é o "Agente Bora", uma inteligência artificial inspirada na mentalidade e nos frameworks de negócios do Alfredo Soares.

ATENÇÃO AO SEU PAPEL:
Você NÃO vai falar diretamente com os clientes finais. Você é o CONSELHEIRO DE BASTIDORES do NOSSO TIME INTERNO.
O nosso time está rodando uma Imersão e cuidando dos mentorados do "CD Grupo".
Sua missão é dar DICAS, DIRECIONAMENTOS E ARGUMENTOS para o nosso time saber exatamente o que falar e como posicionar esses mentorados.

COMO VOCÊ FALA COM O NOSSO TIME:
- Tom direto, energético e de quem joga no mesmo time. Papo-reto.
- Costuma usar "Bora!" e reforça que "a melhor estratégia é atitude".
- Seja incisivo: "Falem pro mentorado que ele precisa..." ou "A dica que vocês têm que dar pra ele hoje é..."

COMO VOCÊ PENSA (Frameworks):
1. Foco na DOR do cliente do mentorado.
2. Criação de ecossistema para não depender só de performance.
3. Indicadores reais (LTV, CAC, recompra).
4. Empreender é inovar e resolver problemas das pessoas.

AO RECEBER O CONTEXTO:
- Analise os gargalos que o mentorado relatou.
- Entregue um diagnóstico rápido.
- Dê a "bala de prata": o que o NOSSO TIME precisa dizer para ele amanhã de manhã que vai mudar o jogo.

LIMITES: Mantenha-se no escopo de negócios, vendas e marca. Não invente métricas que não estão nos textos enviados.

CITAÇÕES (CRÍTICO): Sempre que se basear em uma memória recuperada, cite a fonte usando links Obsidian [[duplos colchetes]].`;

const CS_PROMPT = `Você é um especialista sênior em Customer Success do CD Grupo.

SEU PAPEL:
Você assessora o time interno de CS que acompanha mentorados. Foco em garantir que os mentorados atinjam resultados reais e renovem ou ampliem o engajamento com o CD Grupo.

COMO VOCÊ PENSA:
1. Saúde do cliente: identifique sinais de risco (churn) e oportunidades de expansão.
2. Métricas que importam: NPS, LTV, taxa de recompra, engajamento com conteúdo.
3. Playbook de CS: onboarding, adoção, sucesso definido, renovação.
4. Voz do cliente: expectativas vs. realidade entregue.

COMO VOCÊ FALA:
- Tom consultivo, analítico e baseado em dados.
- Avalie o health score antes de dar recomendações.
- Entregue sempre próximos passos claros e acionáveis para o time.
- Use frases como "O sinal de risco aqui é..." ou "Para garantir a renovação, o time deve..."

LIMITES: Não invente métricas. Base suas análises nos dados presentes no contexto.

CITAÇÕES (CRÍTICO): Sempre cite a fonte usando links Obsidian [[duplos colchetes]].`;

const SDR_PROMPT = `Você é um especialista em SDR (Sales Development Representative) do CD Grupo.

SEU PAPEL:
Você ajuda o time a identificar e qualificar oportunidades de expansão com mentorados existentes e novos prospects.

COMO VOCÊ PENSA:
1. ICP (Ideal Customer Profile): o mentorado ou prospect se encaixa? Há potencial de upsell?
2. Qualificação BANT: Budget, Authority, Need, Timeline.
3. Objeções comuns e como contorná-las com argumentos baseados em resultados.
4. Próximo passo sempre definido: reunião agendada, follow-up ou proposta clara.

COMO VOCÊ FALA:
- Tom objetivo, direto e orientado à conversão.
- Identifique a dor de negócios antes de propor qualquer solução.
- Sugira abordagens de outreach, scripts de contato e ganchos de abertura.
- Use frases como "O hook para esse lead é..." ou "A objeção mais provável vai ser... e a resposta é..."

LIMITES: Foque em qualificação e pipeline. Não invente dados de mercado.

CITAÇÕES (CRÍTICO): Sempre cite a fonte usando links Obsidian [[duplos colchetes]].`;

export const AGENTS = [
  {
    id: "bora",
    name: "Alfredo Soares",
    sub: "Agente Bora",
    color: "#c44a1a",
    soft: "rgba(196,74,26,.10)",
    emoji: "⚡",
    msIcon: "bolt",
    tags: ["Estratégia", "DOR", "LTV/CAC"],
    desc: "Conselheiro de bastidores. Papo-reto, energético, diagnóstico rápido. Frameworks DOR, LTV/CAC e ecossistema de negócios.",
    defaultPrompt: BORA_PROMPT,
  },
  {
    id: "cs",
    name: "Customer Success",
    sub: "CS Advisor",
    color: "#2563EB",
    soft: "rgba(37,99,235,.10)",
    emoji: "🎯",
    msIcon: "support_agent",
    tags: ["Retenção", "Churn", "NPS"],
    desc: "Especialista em retenção, saúde do cliente e churn. Playbooks de CS, métricas de expansão e voz do cliente.",
    defaultPrompt: CS_PROMPT,
  },
  {
    id: "sdr",
    name: "Prospecção & Vendas",
    sub: "SDR",
    color: "#16A34A",
    soft: "rgba(22,163,74,.10)",
    emoji: "📣",
    msIcon: "campaign",
    tags: ["Prospecção", "Pipeline", "ICP"],
    desc: "Especialista em prospecção, qualificação de leads e funil de vendas. Cold outreach, ICP e scripts de conversão.",
    defaultPrompt: SDR_PROMPT,
  },
];

const DEFAULT_SESSIONS = [
  { id: "diag",  icon: "🔍", name: "Diagnóstico Rápido",   desc: "Visão geral do momento do mentorado",       template: "Me dá um diagnóstico rápido do mentorado atual: onde ele está travado e o que precisa agora." },
  { id: "bala",  icon: "🎯", name: "Bala de Prata",        desc: "Uma ação decisiva para essa semana",         template: "Qual a bala de prata para o mentorado essa semana? O que o time precisa falar com ele amanhã de manhã?" },
  { id: "ig",    icon: "📸", name: "Análise de Conteúdo",  desc: "Ideias baseadas no nicho do mentorado",      template: "Busque ideias de conteúdo para o mentorado com base no perfil e nicho dele." },
  { id: "pilar", icon: "🏗️", name: "Pilar Travado",        desc: "Identifica onde o mentorado está preso",     template: "Em qual pilar o mentorado está mais travado e por quê? O que o time precisa falar com ele?" },
  { id: "comp",  icon: "⚖️", name: "Comparar Casos",       desc: "Padrões entre os mentorados da imersão",    template: "Compare os casos da imersão atual e me diz o que eles têm em comum e o que diferencia cada um." },
  { id: "plano", icon: "📋", name: "Plano de Ação",        desc: "Próximos passos concretos",                  template: "Crie um plano de ação para o mentorado com base no que já sabemos. Quais são os 3 movimentos prioritários essa semana?" },
];

const EDIT_TABS = [
  { id: "sessoes",       label: "Sessões",       icon: "calendar_month" },
  { id: "personalidade", label: "Personalidade", icon: "psychology" },
  { id: "configuracao",  label: "Configuração",  icon: "settings" },
  { id: "integracoes",   label: "Integrações",   icon: "hub" },
];

const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Rápido e eficiente — ideal para uso diário" },
  { id: "gpt-4o",      label: "GPT-4o",      desc: "Máxima inteligência — respostas mais profundas" },
];

const DEFAULT_SYSTEM_RULES = `Você tem DOIS blocos de dados abaixo: presença digital (Instagram) e dados de reunião (ficha).
OBRIGAÇÕES:
1. Seu diagnóstico DEVE cobrir AMBOS os blocos — presença digital não é opcional.
2. Comece sempre pela análise de Instagram antes de entrar nos dados de reunião.
3. Dados de Instagram abaixo são reais (coletados via API) — use-os sem restrição, não são invenção.
4. Mesmo que o usuário não mencione Instagram, cubra presença digital na resposta.`;

function makeDefaultAgentsConfig() {
  return {
    bora: { prompt: BORA_PROMPT, sessions: DEFAULT_SESSIONS, systemRules: DEFAULT_SYSTEM_RULES },
    cs:   { prompt: CS_PROMPT,   sessions: DEFAULT_SESSIONS, systemRules: DEFAULT_SYSTEM_RULES },
    sdr:  { prompt: SDR_PROMPT,  sessions: DEFAULT_SESSIONS, systemRules: DEFAULT_SYSTEM_RULES },
  };
}

export default function ProfilePage({ onClose, onLogout, onStartSession, onAgentChange, agentNames: agentNamesProp, onAgentNamesChange }) {
  const [view,    setView]    = useState("agents");
  const [editTab, setEditTab] = useState("sessoes");

  const [activeAgentId,  setActiveAgentId]  = useState("bora");
  const [pendingAgentId, setPendingAgentId] = useState(null);
  const [viewingAgentId, setViewingAgentId] = useState("bora");

  const [agentsConfig,  setAgentsConfig]  = useState(makeDefaultAgentsConfig);
  const [promptDraft,      setPromptDraft]      = useState(BORA_PROMPT);
  const [promptSaved,      setPromptSaved]      = useState(false);
  const [systemRulesDraft, setSystemRulesDraft] = useState(DEFAULT_SYSTEM_RULES);
  const [rulesSaved,       setRulesSaved]       = useState(false);

  const agentNames = agentNamesProp ?? { bora: "", cs: "", sdr: "" };
  const setAgentNames = onAgentNamesChange ?? (() => {});
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState("");

  const [modelDraft,     setModelDraft]     = useState("gpt-4o-mini");
  const [maxTokensDraft, setMaxTokensDraft] = useState(1200);
  const [configSaved,    setConfigSaved]    = useState(false);

  const [editingSession,  setEditingSession]  = useState(null);
  const [editDraft,       setEditDraft]       = useState({});
  const [sessionMenuOpen, setSessionMenuOpen] = useState(null);
  const [apiStatus, setApiStatus] = useState({ openai: false, apify: false, elevenlabs: false });
  const [waStatus, setWaStatus] = useState('idle'); // 'idle' | 'initializing' | 'qr' | 'connected'
  const [waQR,     setWaQR]     = useState(null);

  // Polling do status WhatsApp quando aba integrações está aberta
  useEffect(() => {
    if (editTab !== 'integracoes') return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await authFetch(`${API}/api/whatsapp/status`);
        const d = await r.json();
        if (!alive) return;
        setWaStatus(d.status);
        setWaQR(d.qr || null);
      } catch { /* ignora */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(interval); };
  }, [editTab]);

  async function connectWA() {
    setWaStatus('initializing');
    const r = await authFetch(`${API}/api/whatsapp/connect`, { method: 'POST' });
    const d = await r.json();
    setWaStatus(d.status);
    setWaQR(d.qr || null);
  }

  async function disconnectWA() {
    await authFetch(`${API}/api/whatsapp/disconnect`, { method: 'POST' });
    setWaStatus('idle');
    setWaQR(null);
  }

  async function flushWA() {
    const r = await authFetch(`${API}/api/whatsapp/flush`, { method: 'POST' });
    const d = await r.json();
    alert(`${d.flushed ?? 0} conversa(s) processada(s) e salvas na aba Clientes.`);
  }

  useEffect(() => {
    authFetch(`${API}/api/agent-config`)
      .then(r => r.json())
      .then(data => {
        const activeId = data.activeAgentType || "bora";
        setActiveAgentId(activeId);
        setViewingAgentId(activeId);
        setApiStatus(data.apiKeys || {});
        if (data.model)     setModelDraft(data.model);
        if (data.maxTokens) setMaxTokensDraft(data.maxTokens);
        if (data.agents) {
          setAgentsConfig(prev => {
            const next = { ...prev };
            for (const id of ["bora", "cs", "sdr"]) {
              if (data.agents[id]) {
                next[id] = {
                  prompt:      data.agents[id].prompt      || prev[id].prompt,
                  sessions:    Array.isArray(data.agents[id].sessions) ? data.agents[id].sessions : prev[id].sessions,
                  systemRules: data.agents[id].systemRules || prev[id].systemRules || DEFAULT_SYSTEM_RULES,
                };
              }
            }
            return next;
          });
          const savedPrompt = data.agents[activeId]?.prompt;
          if (savedPrompt) setPromptDraft(savedPrompt);
          const savedRules = data.agents[activeId]?.systemRules;
          if (savedRules) setSystemRulesDraft(savedRules);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPromptDraft(agentsConfig[viewingAgentId]?.prompt || "");
    setSystemRulesDraft(agentsConfig[viewingAgentId]?.systemRules || DEFAULT_SYSTEM_RULES);
    setEditingSession(null);
  }, [viewingAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Agent grid ─────────────────────────────────────────────────────────────

  function handleCardClick(agent) {
    if (agent.id === pendingAgentId) { setPendingAgentId(null); return; }
    setPendingAgentId(agent.id);
    setViewingAgentId(agent.id);
  }

  async function startSessionWithAgent(e, agentId) {
    e?.stopPropagation?.();
    const agent = AGENTS.find(a => a.id === agentId);
    setPendingAgentId(null);
    // Aguarda que handleAgentChange carregue as conversas do novo agente antes de fechar
    // Não faz setActiveAgentId aqui - deixa handleAgentChange fazer
    await onAgentChange?.(agent);
    try {
      await authFetch(`${API}/api/agent-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType: agentId }),
      });
    } catch {}
    onClose();
  }

  function openEditView(e, agentId) {
    e.stopPropagation();
    setViewingAgentId(agentId);
    setPendingAgentId(null);
    setEditTab("sessoes");
    setView("edit");
  }

  function backToAgents() {
    setView("agents");
    setPendingAgentId(null);
  }

  // ── Personalidade ──────────────────────────────────────────────────────────

  async function savePrompt() {
    setAgentsConfig(prev => ({
      ...prev,
      [viewingAgentId]: { ...prev[viewingAgentId], prompt: promptDraft },
    }));
    await authFetch(`${API}/api/agent-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: viewingAgentId, prompt: promptDraft }),
    }).catch(() => {});
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2500);
  }

  async function saveSystemRules() {
    setAgentsConfig(prev => ({
      ...prev,
      [viewingAgentId]: { ...prev[viewingAgentId], systemRules: systemRulesDraft },
    }));
    await authFetch(`${API}/api/agent-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: viewingAgentId, systemRules: systemRulesDraft }),
    }).catch(() => {});
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2500);
  }

  // ── Configuração ───────────────────────────────────────────────────────────

  async function saveConfig() {
    await authFetch(`${API}/api/agent-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelDraft, maxTokens: Number(maxTokensDraft) }),
    }).catch(() => {});
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  }

  // ── Sessões ────────────────────────────────────────────────────────────────

  function currentSessions() {
    return agentsConfig[viewingAgentId]?.sessions || DEFAULT_SESSIONS;
  }

  async function persistSessions(updated) {
    setAgentsConfig(prev => ({
      ...prev,
      [viewingAgentId]: { ...prev[viewingAgentId], sessions: updated },
    }));
    await authFetch(`${API}/api/agent-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: viewingAgentId, sessions: updated }),
    }).catch(() => {});
  }

  function startEdit(session) {
    setEditDraft({ name: session.name, template: session.template });
    setEditingSession(session.id);
  }

  function commitEdit(sessionId) {
    const updated = currentSessions().map(s => s.id === sessionId ? { ...s, ...editDraft } : s);
    persistSessions(updated);
    setEditingSession(null);
  }

  function deleteSession(sessionId) {
    const updated = currentSessions().filter(s => s.id !== sessionId);
    persistSessions(updated);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const viewingAgent = AGENTS.find(a => a.id === viewingAgentId);
  const isViewingActive = activeAgentId === viewingAgentId;

  return (
    <main className="main pf-main">

      {/* ── Nav ── */}
      <nav className="pf-nav">
        {view === "edit" ? (
          <button className="pf-nav-back" onClick={backToAgents}>
            <span className="pf-ms-sm">arrow_back</span>
            Agentes
          </button>
        ) : (
          <div className="pf-nav-brand">
            <div className="pf-nav-brand-icon">
              <span className="pf-ms-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
            <span className="pf-nav-brand-name">CD Grupo</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="pf-logout-btn" onClick={onLogout} title="Sair">
            <span className="pf-ms-sm">logout</span>
            Sair
          </button>
          <button className="pf-nav-close" onClick={onClose} title="Voltar ao chat">
            <span className="pf-ms-sm">close</span>
          </button>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="pf-body">

        {/* ════════════════════ VIEW: AGENTES ════════════════════ */}
        {view === "agents" && (
          <div>
            <div className="pf-page-header">
              <h2 className="pf-page-title">Selecione o Agente</h2>
              <p className="pf-page-sub">
                Cada agente tem personalidade, sessões e configurações independentes.
              </p>
            </div>

            <div className="pf-ag-grid">
              {AGENTS.map(agent => {
                const isActive  = activeAgentId  === agent.id;
                const isPending = pendingAgentId  === agent.id;
                return (
                  <button
                    key={agent.id}
                    className={"pf-ag-card" + (isActive ? " active" : "") + (isPending ? " pending" : "")}
                    style={{ "--agent-color": agent.color, "--agent-soft": agent.soft }}
                    onClick={() => handleCardClick(agent)}
                  >
                    {isActive && !isPending && (
                      <div className="pf-ag-badge-wrap">
                        <span className="pf-ag-badge-active">
                          <span className="pf-ag-badge-dot" />ATIVO
                        </span>
                      </div>
                    )}
                    {isPending && (
                      <div className="pf-ag-badge-wrap">
                        <span className="pf-ag-badge-pending">SELECIONADO</span>
                      </div>
                    )}
                    <div className="pf-ag-icon-wrap" style={{ background: agent.color }}>
                      <span className="pf-ms-lg">{agent.msIcon}</span>
                    </div>
                    <h3 className="pf-ag-name">{agentNames[agent.id] || agent.name}</h3>
                    <p className="pf-ag-sub">{agent.sub}</p>
                    <p className="pf-ag-desc">{agent.desc}</p>
                    <div className="pf-ag-tags">
                      {agent.tags.map(tag => <span key={tag} className="pf-ag-tag">{tag}</span>)}
                    </div>
                    {isPending && (
                      <div className="pf-ag-actions">
                        <button className="pf-ag-btn-edit" onClick={(e) => openEditView(e, agent.id)}>
                          <span className="pf-ms-sm">edit</span>
                          Editar Agente
                        </button>
                        <button className="pf-ag-btn-start" style={{ background: agent.color }} onClick={(e) => startSessionWithAgent(e, agent.id)}>
                          Iniciar Sessão →
                        </button>
                      </div>
                    )}
                  </button>
                );
              })}

            </div>

            <div className="pf-tip-banner">
              <div className="pf-tip-icon">💡</div>
              <div className="pf-tip-content">
                <h4 className="pf-tip-title">Dica do Time</h4>
                <p className="pf-tip-text">
                  Alterne entre agentes a qualquer momento. Personalidade, sessões e configurações são salvas individualmente para cada agente.
                </p>
              </div>
              <button className="pf-tip-btn" onClick={onClose}>Ir ao Chat →</button>
            </div>
          </div>
        )}

        {/* ════════════════════ VIEW: EDIT ════════════════════ */}
        {view === "edit" && viewingAgent && (
          <div>

            {/* ── Profile hero ── */}
            <div className="pf-profile-hero" style={{ "--agent-color": viewingAgent.color, "--agent-soft": viewingAgent.soft }}>
              <div className="pf-profile-avatar-wrap">
                <div className="pf-profile-avatar" style={{ background: viewingAgent.color }}>
                  <span className="pf-ms" style={{ fontSize: 52, fontVariationSettings: "'FILL' 1", color: "#fff", lineHeight: 1 }}>
                    {viewingAgent.msIcon}
                  </span>
                </div>
                {isViewingActive && (
                  <div className="pf-profile-active-ring" style={{ borderColor: viewingAgent.color }} />
                )}
                {isViewingActive && (
                  <span className="pf-profile-ativo-badge" style={{ background: viewingAgent.color }}>
                    <span className="pf-ag-badge-dot" style={{ background: "#fff" }} />
                    ATIVO
                  </span>
                )}
              </div>

              <div className="pf-profile-name-wrap">
                {editingName ? (
                  <input
                    className="pf-profile-name-input"
                    value={nameDraft}
                    onChange={e => setNameDraft(e.target.value)}
                    onBlur={() => { setAgentNames(n => ({ ...n, [viewingAgentId]: nameDraft.trim() || viewingAgent.name })); setEditingName(false); }}
                    onKeyDown={e => {
                      if (e.key === "Enter") { setAgentNames(n => ({ ...n, [viewingAgentId]: nameDraft.trim() || viewingAgent.name })); setEditingName(false); }
                      if (e.key === "Escape") { setEditingName(false); }
                    }}
                    autoFocus
                  />
                ) : (
                  <h1 className="pf-profile-name">
                    {agentNames[viewingAgentId] || viewingAgent.name}
                  </h1>
                )}
                <button
                  className="pf-profile-pencil"
                  onClick={() => { setNameDraft(agentNames[viewingAgentId] || viewingAgent.name); setEditingName(true); }}
                  title="Editar nome"
                >
                  <span className="pf-ms-sm">edit</span>
                </button>
              </div>
              <p className="pf-profile-role" style={{ color: viewingAgent.color }}>{viewingAgent.sub}</p>
              <p className="pf-profile-desc">{viewingAgent.desc}</p>

              <div className="pf-profile-tags">
                {viewingAgent.tags.map(tag => (
                  <span key={tag} className="pf-profile-tag">{tag}</span>
                ))}
              </div>

              <button
                className="pf-profile-start-btn"
                style={{ background: viewingAgent.color }}
                onClick={() => startSessionWithAgent(null, viewingAgentId)}
              >
                <span className="pf-ms-sm" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                Iniciar Sessão
              </button>
            </div>

            {/* ── Profile tab bar ── */}
            <div className="pf-profile-tabs" style={{ "--agent-color": viewingAgent.color }}>
              {EDIT_TABS.map(t => (
                <button
                  key={t.id}
                  className={"pf-profile-tab" + (editTab === t.id ? " active" : "")}
                  onClick={() => setEditTab(t.id)}
                >
                  <span className="pf-ms-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Sessões ── */}
            {editTab === "sessoes" && (
              <div className="pf-tab-content">
                <div className="pf-session-grid">
                  {currentSessions().map(session => (
                    <div key={session.id} className="pf-session-card">
                      {editingSession === session.id ? (
                        <div className="pf-session-edit">
                          <input
                            className="pf-session-edit-name"
                            value={editDraft.name}
                            onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                            placeholder="Nome da sessão"
                          />
                          <textarea
                            className="pf-session-edit-tmpl"
                            value={editDraft.template}
                            onChange={e => setEditDraft(d => ({ ...d, template: e.target.value }))}
                            rows={3}
                            placeholder="Template de mensagem"
                          />
                          <div className="pf-session-edit-actions">
                            <button className="pf-session-cancel" onClick={() => setEditingSession(null)}>Cancelar</button>
                            <button className="pf-session-save" style={{ background: viewingAgent.color }} onClick={() => commitEdit(session.id)}>Salvar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="pf-session-top">
                            <span className="pf-session-icon">{session.icon}</span>
                            <div className="pf-session-texts">
                              <div className="pf-session-name">{session.name}</div>
                              <div className="pf-session-desc">{session.desc}</div>
                            </div>
                            <div className="pf-session-menu-wrap">
                              <button
                                className="pf-session-dots"
                                onClick={e => { e.stopPropagation(); setSessionMenuOpen(sessionMenuOpen === session.id ? null : session.id); }}
                              >···</button>
                              {sessionMenuOpen === session.id && (
                                <div className="pf-session-dropdown">
                                  <button className="pf-session-drop-item" onClick={e => { e.stopPropagation(); startEdit(session); setSessionMenuOpen(null); }}>✏️ Editar</button>
                                  <button className="pf-session-drop-item pf-session-drop-delete" onClick={e => { e.stopPropagation(); deleteSession(session.id); setSessionMenuOpen(null); }}>🗑 Excluir</button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="pf-session-tmpl">"{session.template}"</div>
                          <button
                            className="pf-session-start"
                            style={{ background: viewingAgent.color }}
                            onClick={() => { onStartSession(session.template); onClose(); }}
                          >
                            Iniciar sessão →
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab: Personalidade ── */}
            {editTab === "personalidade" && (
              <div className="pf-tab-content">

                {/* Identidade */}
                <div className="pf-section-label">
                  <span className="pf-ms-sm">psychology</span>
                  Identidade
                </div>
                <div className="pf-prompt-wrap">
                  <textarea
                    className="pf-prompt-ta"
                    value={promptDraft}
                    onChange={e => setPromptDraft(e.target.value)}
                    rows={18}
                    placeholder="Descreva como o agente deve se comportar, seu tom, seus frameworks e seus limites…"
                    spellCheck={false}
                  />
                  <div className="pf-prompt-actions">
                    <span className="pf-prompt-hint">
                      {promptDraft.length} chars · {promptDraft.split(/\s+/).filter(Boolean).length} palavras
                    </span>
                    <div className="pf-prompt-btns">
                      <button className="pf-preset-btn" onClick={() => setPromptDraft(viewingAgent.defaultPrompt || "")}>
                        {viewingAgent.emoji} Restaurar padrão
                      </button>
                      <button
                        className={"pf-save-btn" + (promptSaved ? " saved" : "")}
                        onClick={savePrompt}
                        disabled={promptSaved}
                        style={!promptSaved ? { background: viewingAgent.color } : {}}
                      >
                        {promptSaved ? "✓ Salvo!" : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Regras de Diagnóstico */}
                <div className="pf-rules-divider" />
                <div className="pf-section-label">
                  <span className="pf-ms-sm">rule</span>
                  Regras de Diagnóstico
                </div>
                <p className="pf-rules-desc">
                  Injetadas automaticamente no contexto quando o mentorado tem Instagram conectado.
                  Definem o comportamento obrigatório que complementa a identidade acima — independente do que o usuário escrever no chat.
                  Use <code>{"{mentorado}"}</code> para referenciar o nome do mentorado em tempo real.
                </p>
                <div className="pf-prompt-wrap pf-rules-wrap">
                  <textarea
                    className="pf-prompt-ta pf-rules-ta"
                    value={systemRulesDraft}
                    onChange={e => setSystemRulesDraft(e.target.value)}
                    rows={8}
                    spellCheck={false}
                  />
                  <div className="pf-prompt-actions">
                    <span className="pf-prompt-hint">
                      {systemRulesDraft.length} chars
                    </span>
                    <div className="pf-prompt-btns">
                      <button className="pf-preset-btn" onClick={() => setSystemRulesDraft(DEFAULT_SYSTEM_RULES)}>
                        ↺ Restaurar padrão
                      </button>
                      <button
                        className={"pf-save-btn" + (rulesSaved ? " saved" : "")}
                        onClick={saveSystemRules}
                        disabled={rulesSaved}
                        style={!rulesSaved ? { background: viewingAgent.color } : {}}
                      >
                        {rulesSaved ? "✓ Salvo!" : "Salvar regras"}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── Tab: Configuração ── */}
            {editTab === "configuracao" && (
              <div className="pf-tab-content">
                <div className="pf-config-section">
                  <h4 className="pf-config-section-title">Modelo de IA</h4>
                  <p className="pf-config-section-sub">Escolha o modelo utilizado por todos os agentes nas conversas.</p>
                  <div className="pf-model-grid">
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        className={"pf-model-card" + (modelDraft === m.id ? " selected" : "")}
                        style={modelDraft === m.id ? { "--agent-color": viewingAgent.color } : {}}
                        onClick={() => setModelDraft(m.id)}
                      >
                        <div className="pf-model-card-top">
                          <span className="pf-ms-sm">smart_toy</span>
                          {modelDraft === m.id && <span className="pf-model-check" style={{ color: viewingAgent.color }}>✓</span>}
                        </div>
                        <div className="pf-model-name">{m.label}</div>
                        <div className="pf-model-desc">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pf-config-section">
                  <h4 className="pf-config-section-title">Limite de Tokens</h4>
                  <p className="pf-config-section-sub">Controla o tamanho máximo de cada resposta gerada.</p>
                  <div className="pf-token-wrap">
                    <input
                      type="range"
                      min={400}
                      max={4000}
                      step={100}
                      value={maxTokensDraft}
                      onChange={e => setMaxTokensDraft(Number(e.target.value))}
                      className="pf-token-range"
                      style={{ "--agent-color": viewingAgent.color }}
                    />
                    <div className="pf-token-labels">
                      <span>400</span>
                      <span className="pf-token-value" style={{ color: viewingAgent.color }}>{maxTokensDraft} tokens</span>
                      <span>4000</span>
                    </div>
                  </div>
                </div>

                <div className="pf-config-save-row">
                  <button
                    className={"pf-save-btn" + (configSaved ? " saved" : "")}
                    onClick={saveConfig}
                    disabled={configSaved}
                    style={!configSaved ? { background: viewingAgent.color } : {}}
                  >
                    {configSaved ? "✓ Configuração salva!" : "Salvar Configuração"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Integrações ── */}
            {editTab === "integracoes" && (
              <div className="pf-tab-content">
                <div className="pf-int-list">
                  <IntRow icon={<IgIcon />} name="Instagram"    desc="Análise de perfil, posts e hashtags dos mentorados"  connected={apiStatus.apify}      hint={!apiStatus.apify      ? "Adicione APIFY_API_KEY no server/.env" : null} />
                  <IntRow icon="🔊" name="ElevenLabs TTS"      desc="Síntese de voz para respostas em áudio"              connected={apiStatus.elevenlabs} hint={!apiStatus.elevenlabs ? "Adicione ELEVENLABS_API_KEY no server/.env" : null} />
                </div>

                {/* WhatsApp */}
                <div className="pf-wa-wrap">
                  <div className="pf-int-row">
                    <span className="pf-int-icon"><WaIcon /></span>
                    <div className="pf-int-info">
                      <div className="pf-int-name">WhatsApp</div>
                      <div className="pf-int-desc">
                        {waStatus === 'connected'    && 'Conectado — pronto para enviar e receber mensagens'}
                        {waStatus === 'qr'           && 'Escaneie o QR Code com seu celular'}
                        {waStatus === 'initializing' && 'Inicializando…'}
                        {waStatus === 'idle'         && 'Conecte seu WhatsApp para integrar ao agente'}
                      </div>
                    </div>
                    <div className="pf-int-badge" data-ok={waStatus === 'connected'}>
                      {waStatus === 'connected'    ? 'Conectado'
                       : waStatus === 'qr'         ? 'Aguardando leitura'
                       : waStatus === 'initializing' ? 'Iniciando…'
                       : 'Desconectado'}
                    </div>
                    {waStatus === 'connected' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="pf-wa-btn pf-wa-btn--flush" onClick={flushWA} title="Gerar resumos das conversas pendentes agora">Gerar resumos</button>
                        <button className="pf-wa-btn pf-wa-btn--off" onClick={disconnectWA}>Desconectar</button>
                      </div>
                    ) : (
                      <button className="pf-wa-btn" onClick={connectWA} disabled={waStatus === 'initializing' || waStatus === 'qr'}>
                        {waStatus === 'initializing' || waStatus === 'qr' ? 'Aguardando…' : 'Conectar'}
                      </button>
                    )}
                  </div>

                  {waStatus === 'qr' && waQR && (
                    <div className="pf-wa-qr-wrap">
                      <img className="pf-wa-qr-img" src={waQR} alt="QR Code WhatsApp" />
                      <div className="pf-wa-qr-hint">
                        <span className="pf-ms-sm" style={{ fontSize: 18 }}>smartphone</span>
                        Abra o WhatsApp → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function IntRow({ icon, name, desc, connected, hint }) {
  return (
    <div className="pf-int-row">
      <span className="pf-int-icon">{icon}</span>
      <div className="pf-int-info">
        <div className="pf-int-name">{name}</div>
        <div className="pf-int-desc">{desc}</div>
        {hint && <div className="pf-int-hint">{hint}</div>}
      </div>
      <span className={"pf-int-status" + (connected ? " ok" : " off")}>
        {connected ? "● Conectado" : "○ Não configurado"}
      </span>
    </div>
  );
}

function IgIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <radialGradient id="ig-g1" cx="30%" cy="107%" r="130%">
          <stop offset="0%"  stopColor="#fdf497" />
          <stop offset="10%" stopColor="#fdf497" />
          <stop offset="28%" stopColor="#fd5949" />
          <stop offset="53%" stopColor="#d6249f" />
          <stop offset="74%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="26" height="26" rx="7" fill="url(#ig-g1)" />
      <rect x="7.5" y="7.5" width="11" height="11" rx="3.2" stroke="white" strokeWidth="1.7" fill="none" />
      <circle cx="13" cy="13" r="3" stroke="white" strokeWidth="1.7" fill="none" />
      <circle cx="18.1" cy="7.9" r="1.1" fill="white" />
    </svg>
  );
}

function WaIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <rect width="26" height="26" rx="7" fill="#25D366" />
      <path d="M13 4.5C8.31 4.5 4.5 8.31 4.5 13c0 1.5.39 2.91 1.07 4.14L4.5 21.5l4.47-1.05A8.47 8.47 0 0013 21.5c4.69 0 8.5-3.81 8.5-8.5S17.69 4.5 13 4.5z" fill="white" />
      <path d="M17.4 15.4c-.24-.12-1.4-.69-1.61-.77-.22-.08-.37-.12-.53.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.53-1.28-.73-1.75-.19-.46-.39-.4-.53-.4h-.45c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28z" fill="#25D366" />
    </svg>
  );
}
