import { useState, useEffect } from "react";
import { API, authFetch } from "../api";
import "./CRMPage.css";

const STAGES = [
  { id: "lead",       label: "Novo contato",        color: "#F0531C", icon: "📩" },
  { id: "conversa",   label: "Conversando",          color: "#3B82F6", icon: "💬" },
  { id: "aguardando", label: "Aguardando produto",  color: "#F59E0B", icon: "📦" },
  { id: "visita",     label: "Visita marcada",      color: "#8B5CF6", icon: "📅" },
  { id: "comprou",    label: "Comprou",             color: "#16A34A", icon: "✅" },
];

const CANAIS = ["whatsapp", "shopee", "mercadolivre", "presencial", "outro"];
const CANAL_LABEL = { whatsapp: "WhatsApp", shopee: "Shopee", mercadolivre: "Mercado Livre", presencial: "Presencial", outro: "Outro" };
const CANAL_COLOR = { whatsapp: "#25D366", shopee: "#EE4D2D", mercadolivre: "#FFE600", presencial: "#6B7280", outro: "#9CA3AF" };

const EMPTY_FORM = { nome: "", telefone: "", canal: "whatsapp", estagio: "lead", produto_interesse: "", notas: "", visita_data: "" };

export default function CRMPage({ onClose }) {
  const [clientes, setClientes]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [addForm,  setAddForm]        = useState(false);
  const [draft,    setDraft]          = useState(EMPTY_FORM);
  const [saving,   setSaving]         = useState(false);
  const [editMode, setEditMode]       = useState(false);
  const [alertas,  setAlertas]        = useState([]);
  const [search,       setSearch]     = useState("");
  const [filtroCanal,  setFiltroCanal]= useState("todos");
  const [filtroRapido, setFiltroRapido] = useState("");
  const [campanhaOpen, setCampanhaOpen] = useState(false);
  const [campanhaTextos, setCampanhaTextos] = useState({});

  useEffect(() => {
    authFetch(`${API}/api/crm`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setClientes(data);
      // Alertas: visitas nas próximas 24h
      const now = new Date();
      const alerts = data.filter(c => {
        if (!c.visita_data) return false;
        const diff = new Date(c.visita_data) - now;
        return diff > 0 && diff < 24 * 60 * 60 * 1000;
      });
      setAlertas(alerts);
    }).catch(() => setLoading(false));
  }, []);

  async function addCliente() {
    if (!draft.nome.trim()) return;
    setSaving(true);
    const res = await authFetch(`${API}/api/crm`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (data?.id) { setClientes(c => [data, ...c]); setDraft(EMPTY_FORM); setAddForm(false); }
    setSaving(false);
  }

  async function moveStage(id, novoEstagio) {
    const res = await authFetch(`${API}/api/crm/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estagio: novoEstagio, ultimo_contato: new Date().toISOString() }),
    });
    const data = await res.json();
    if (data?.id) {
      setClientes(c => c.map(x => x.id === id ? data : x));
      if (selected?.id === id) setSelected(data);
    }
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    const res = await authFetch(`${API}/api/crm/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    const data = await res.json();
    if (data?.id) { setClientes(c => c.map(x => x.id === data.id ? data : x)); setSelected(data); }
    setSaving(false);
    setEditMode(false);
  }

  async function deleteCliente(id) {
    if (!confirm("Remover este cliente do CRM?")) return;
    await authFetch(`${API}/api/crm/${id}`, { method: "DELETE" });
    setClientes(c => c.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  function lembrete(c) {
    const data = c.visita_data ? new Date(c.visita_data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    return `Oi ${c.nome.split(" ")[0]}! Tudo bem? 😊 Só passando pra lembrar que você tem uma visita marcada${data ? ` pra ${data}` : ""}${c.produto_interesse ? ` pra buscar ${c.produto_interesse}` : ""}. Confirma pra mim? 🙏`;
  }

  const stats = {
    total:     clientes.length,
    visitas:   clientes.filter(c => c.estagio === "visita").length,
    aguardando: clientes.filter(c => c.estagio === "aguardando").length,
    comprou:   clientes.filter(c => c.estagio === "comprou").length,
  };

  const canaisPresentes = [...new Set(clientes.map(c => c.canal).filter(Boolean))];

  const hoje = new Date();
  const clientesFiltrados = clientes.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.nome.toLowerCase().includes(q) && !(c.telefone || "").includes(q) && !(c.produto_interesse || "").toLowerCase().includes(q)) return false;
    }
    if (filtroCanal !== "todos" && c.canal !== filtroCanal) return false;
    if (filtroRapido === "visita_hoje") {
      if (!c.visita_data) return false;
      const v = new Date(c.visita_data);
      if (v.toDateString() !== hoje.toDateString()) return false;
    }
    if (filtroRapido === "aguardando") return c.estagio === "aguardando";
    if (filtroRapido === "sem_contato") {
      if (!c.ultimo_contato) return true;
      return (hoje - new Date(c.ultimo_contato)) > 7 * 24 * 60 * 60 * 1000;
    }
    return true;
  });

  const filtrando = search || filtroCanal !== "todos" || filtroRapido;

  return (
    <div className="crm-page">
      {/* ── Header ── */}
      <header className="crm-header">
        <div className="crm-header-left">
          <button className="crm-back" onClick={onClose}>← Voltar</button>
          <div>
            <h1 className="crm-title">CRM <span>Galpão</span></h1>
            <p className="crm-sub">Pipeline de clientes · {clientes.length} no total</p>
          </div>
        </div>
        <div className="crm-stats">
          <div className="crm-stat"><span className="crm-stat-n">{stats.total}</span><span className="crm-stat-l">Clientes</span></div>
          <div className="crm-stat"><span className="crm-stat-n" style={{ color: "#8B5CF6" }}>{stats.visitas}</span><span className="crm-stat-l">Visitas marcadas</span></div>
          <div className="crm-stat"><span className="crm-stat-n" style={{ color: "#F59E0B" }}>{stats.aguardando}</span><span className="crm-stat-l">Aguardando produto</span></div>
          <div className="crm-stat"><span className="crm-stat-n" style={{ color: "#16A34A" }}>{stats.comprou}</span><span className="crm-stat-l">Compraram</span></div>
        </div>
        <div className="crm-header-right">
          {/* ── Botão de campanhas ── */}
          <div className="crm-campanha-wrap">
            <button
              className={"crm-campanha-btn" + (campanhaOpen ? " active" : "")}
              onClick={() => setCampanhaOpen(o => !o)}
            >
              📣 Campanhas
              {clientes.filter(c => c.estagio === "aguardando").length > 0 && (
                <span className="crm-campanha-badge">
                  {clientes.filter(c => c.estagio === "aguardando").length}
                </span>
              )}
            </button>

            {campanhaOpen && (
              <div className="crm-campanha-panel">
                <div className="crm-campanha-head">
                  <span>📦 Clientes aguardando produto</span>
                  <button className="crm-detail-close" onClick={() => setCampanhaOpen(false)}>✕</button>
                </div>
                {clientes.filter(c => c.estagio === "aguardando").length === 0 ? (
                  <div className="crm-campanha-empty">Nenhum cliente aguardando produto.</div>
                ) : (
                  <div className="crm-campanha-list">
                    {clientes.filter(c => c.estagio === "aguardando").map(c => {
                      const msgPadrao = `Oi ${c.nome.split(" ")[0]}! 🎉 Boa notícia — ${c.produto_interesse ? `o(a) ${c.produto_interesse}` : "o produto que você pediu"} chegou! Quer marcar para vir buscar? Me fala um horário bom pra você! 😊`;
                      const msg = campanhaTextos[c.id] ?? msgPadrao;
                      return (
                        <div key={c.id} className="crm-campanha-item">
                          <div className="crm-campanha-nome">{c.nome}</div>
                          {c.produto_interesse && <div className="crm-campanha-produto">📦 {c.produto_interesse}</div>}
                          <textarea
                            className="crm-campanha-textarea"
                            value={msg}
                            rows={4}
                            onChange={e => setCampanhaTextos(t => ({ ...t, [c.id]: e.target.value }))}
                          />
                          <div className="crm-campanha-actions">
                            <button className="crm-campanha-copy" onClick={() => navigator.clipboard.writeText(msg)}>
                              Copiar
                            </button>
                            <button className="crm-campanha-copy" style={{ color: "#64748b" }} onClick={() => setCampanhaTextos(t => { const n = { ...t }; delete n[c.id]; return n; })}>
                              Resetar
                            </button>
                            {c.telefone && (
                              <a
                                className="crm-campanha-wa"
                                href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                WhatsApp ↗
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="crm-add-btn" onClick={() => { setAddForm(true); setSelected(null); }}>+ Novo cliente</button>
        </div>
      </header>

      {/* ── Alertas de visita ── */}
      {alertas.length > 0 && (
        <div className="crm-alertas">
          {alertas.map(c => (
            <div key={c.id} className="crm-alerta">
              🔔 <strong>{c.nome}</strong> tem visita em menos de 24h
              {c.visita_data && <> · {new Date(c.visita_data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</>}
              <button className="crm-alerta-copy" onClick={() => navigator.clipboard.writeText(lembrete(c))}>Copiar lembrete</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="crm-filters">
        <input
          className="crm-search"
          placeholder="Buscar por nome, telefone ou produto…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="crm-filter-pills">
          <button className={"crm-pill" + (filtroCanal === "todos" ? " active" : "")} onClick={() => setFiltroCanal("todos")}>Todos</button>
          {canaisPresentes.map(canal => (
            <button
              key={canal}
              className={"crm-pill" + (filtroCanal === canal ? " active" : "")}
              style={filtroCanal === canal ? { background: CANAL_COLOR[canal], borderColor: CANAL_COLOR[canal] } : {}}
              onClick={() => setFiltroCanal(filtroCanal === canal ? "todos" : canal)}
            >
              {CANAL_LABEL[canal] || canal}
            </button>
          ))}
        </div>
        <div className="crm-filter-quick">
          <button className={"crm-pill crm-pill--quick" + (filtroRapido === "visita_hoje" ? " active" : "")} onClick={() => setFiltroRapido(f => f === "visita_hoje" ? "" : "visita_hoje")}>📅 Visita hoje</button>
          <button className={"crm-pill crm-pill--quick" + (filtroRapido === "aguardando" ? " active" : "")} onClick={() => setFiltroRapido(f => f === "aguardando" ? "" : "aguardando")}>📦 Aguardando produto</button>
          <button className={"crm-pill crm-pill--quick" + (filtroRapido === "sem_contato" ? " active" : "")} onClick={() => setFiltroRapido(f => f === "sem_contato" ? "" : "sem_contato")}>🕐 Sem contato há 7+ dias</button>
          {filtrando && (
            <button className="crm-pill crm-pill--clear" onClick={() => { setSearch(""); setFiltroCanal("todos"); setFiltroRapido(""); }}>
              ✕ Limpar filtros · {clientesFiltrados.length}/{clientes.length}
            </button>
          )}
        </div>
      </div>

      <div className="crm-body">
        {/* ── Kanban ── */}
        <div className="crm-kanban">
          {STAGES.map((stage, si) => {
            const cols = clientesFiltrados.filter(c => c.estagio === stage.id);
            return (
              <div key={stage.id} className="crm-col">
                <div className="crm-col-bar" style={{ background: stage.color }} />
                <div className="crm-col-head">
                  <span className="crm-col-label">{stage.icon} {stage.label}</span>
                  <span className="crm-col-count" style={{ background: stage.color }}>{cols.length}</span>
                </div>
                <div className="crm-col-body">
                  {cols.length === 0 && <div className="crm-empty">Nenhum cliente aqui</div>}
                  {cols.map(c => (
                    <div
                      key={c.id}
                      className={"crm-card" + (selected?.id === c.id ? " crm-card--sel" : "")}
                      onClick={() => { setSelected(c); setEditMode(false); setAddForm(false); }}
                    >
                      <div className="crm-card-top">
                        <div className="crm-card-nome">{c.nome}</div>
                        <span className="crm-canal-badge" style={{ background: CANAL_COLOR[c.canal] || "#9CA3AF" }}>
                          {CANAL_LABEL[c.canal] || c.canal}
                        </span>
                      </div>
                      {c.produto_interesse && <div className="crm-card-produto">📦 {c.produto_interesse}</div>}
                      {c.telefone && <div className="crm-card-tel">📞 {c.telefone}</div>}
                      {c.visita_data && (
                        <div className="crm-card-visita">
                          📅 {new Date(c.visita_data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          {c.visita_confirmada && <span className="crm-confirmado">✓ confirmado</span>}
                        </div>
                      )}
                      <div className="crm-card-actions">
                        {si > 0 && (
                          <button className="crm-move-btn" title="Voltar estágio"
                            onClick={e => { e.stopPropagation(); moveStage(c.id, STAGES[si - 1].id); }}>←</button>
                        )}
                        {si < STAGES.length - 1 && (
                          <button className="crm-move-btn crm-move-btn--next" title="Avançar estágio"
                            onClick={e => { e.stopPropagation(); moveStage(c.id, STAGES[si + 1].id); }}>→</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Painel lateral: detalhe / form ── */}
        {(selected || addForm) && (
          <aside className="crm-detail">
            {addForm && (
              <>
                <div className="crm-detail-head">
                  <h3>Novo cliente</h3>
                  <button className="crm-detail-close" onClick={() => setAddForm(false)}>✕</button>
                </div>
                <div className="crm-form">
                  <label>Nome *</label>
                  <input className="crm-input" placeholder="Nome completo" value={draft.nome} onChange={e => setDraft(d => ({ ...d, nome: e.target.value }))} />
                  <label>Telefone</label>
                  <input className="crm-input" placeholder="(11) 99999-0000" value={draft.telefone} onChange={e => setDraft(d => ({ ...d, telefone: e.target.value }))} />
                  <label>Canal de origem</label>
                  <select className="crm-input" value={draft.canal} onChange={e => setDraft(d => ({ ...d, canal: e.target.value }))}>
                    {CANAIS.map(c => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
                  </select>
                  <label>Estágio inicial</label>
                  <select className="crm-input" value={draft.estagio} onChange={e => setDraft(d => ({ ...d, estagio: e.target.value }))}>
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <label>Produto de interesse</label>
                  <input className="crm-input" placeholder="ex: Bombona 200L azul" value={draft.produto_interesse} onChange={e => setDraft(d => ({ ...d, produto_interesse: e.target.value }))} />
                  <label>Data da visita</label>
                  <input className="crm-input" type="datetime-local" value={draft.visita_data} onChange={e => setDraft(d => ({ ...d, visita_data: e.target.value }))} />
                  <label>Observações</label>
                  <textarea className="crm-input crm-textarea" rows={3} placeholder="Notas sobre o cliente..." value={draft.notas} onChange={e => setDraft(d => ({ ...d, notas: e.target.value }))} />
                  <button className="crm-save-btn" onClick={addCliente} disabled={saving || !draft.nome.trim()}>
                    {saving ? "Salvando…" : "Adicionar ao CRM"}
                  </button>
                </div>
              </>
            )}

            {selected && !addForm && (
              <>
                <div className="crm-detail-head">
                  <div>
                    <h3>{selected.nome}</h3>
                    <span className="crm-canal-badge" style={{ background: CANAL_COLOR[selected.canal] || "#9CA3AF" }}>
                      {CANAL_LABEL[selected.canal] || selected.canal}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="crm-edit-btn" onClick={() => setEditMode(e => !e)}>{editMode ? "Cancelar" : "✏ Editar"}</button>
                    <button className="crm-detail-close" onClick={() => setSelected(null)}>✕</button>
                  </div>
                </div>

                {/* Estágio atual */}
                <div className="crm-detail-stage">
                  {STAGES.map(s => (
                    <button key={s.id}
                      className={"crm-stage-pill" + (selected.estagio === s.id ? " active" : "")}
                      style={selected.estagio === s.id ? { background: s.color } : {}}
                      onClick={() => moveStage(selected.id, s.id)}
                    >{s.icon} {s.label}</button>
                  ))}
                </div>

                {editMode ? (
                  <div className="crm-form">
                    <label>Nome</label>
                    <input className="crm-input" value={selected.nome} onChange={e => setSelected(s => ({ ...s, nome: e.target.value }))} />
                    <label>Telefone</label>
                    <input className="crm-input" value={selected.telefone || ""} onChange={e => setSelected(s => ({ ...s, telefone: e.target.value }))} />
                    <label>Canal</label>
                    <select className="crm-input" value={selected.canal || "whatsapp"} onChange={e => setSelected(s => ({ ...s, canal: e.target.value }))}>
                      {CANAIS.map(c => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
                    </select>
                    <label>Produto de interesse</label>
                    <input className="crm-input" value={selected.produto_interesse || ""} onChange={e => setSelected(s => ({ ...s, produto_interesse: e.target.value }))} />
                    <label>Data da visita</label>
                    <input className="crm-input" type="datetime-local"
                      value={selected.visita_data ? new Date(selected.visita_data).toISOString().slice(0, 16) : ""}
                      onChange={e => setSelected(s => ({ ...s, visita_data: e.target.value || null }))} />
                    <label>Visita confirmada?</label>
                    <select className="crm-input" value={selected.visita_confirmada ? "sim" : "nao"} onChange={e => setSelected(s => ({ ...s, visita_confirmada: e.target.value === "sim" }))}>
                      <option value="nao">Não confirmada</option>
                      <option value="sim">Confirmada ✓</option>
                    </select>
                    <label>Observações</label>
                    <textarea className="crm-input crm-textarea" rows={4} value={selected.notas || ""} onChange={e => setSelected(s => ({ ...s, notas: e.target.value }))} />
                    <button className="crm-save-btn" onClick={saveEdit} disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>
                  </div>
                ) : (
                  <div className="crm-detail-body">
                    {selected.telefone && <div className="crm-detail-row"><span>📞</span><a href={`https://wa.me/55${selected.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{selected.telefone}</a></div>}
                    {selected.produto_interesse && <div className="crm-detail-row"><span>📦</span><span>{selected.produto_interesse}</span></div>}
                    {selected.visita_data && (
                      <div className="crm-detail-row">
                        <span>📅</span>
                        <span>{new Date(selected.visita_data).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
                          {selected.visita_confirmada && <strong style={{ color: "#16a34a", marginLeft: 6 }}>✓ confirmada</strong>}
                        </span>
                      </div>
                    )}
                    {selected.notas && <div className="crm-detail-notas">{selected.notas}</div>}
                    <div className="crm-detail-row crm-detail-muted">
                      <span>🕐</span><span>Cadastrado em {new Date(selected.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>

                    {/* Lembrete de visita */}
                    {selected.estagio === "visita" && (
                      <div className="crm-lembrete-box">
                        <div className="crm-lembrete-label">💬 Mensagem de lembrete</div>
                        <div className="crm-lembrete-text">{lembrete(selected)}</div>
                        <button className="crm-lembrete-copy" onClick={() => navigator.clipboard.writeText(lembrete(selected))}>Copiar mensagem</button>
                      </div>
                    )}

                    {/* Ação de disparo para aguardando produto */}
                    {selected.estagio === "aguardando" && (
                      <div className="crm-lembrete-box crm-lembrete-box--amarelo">
                        <div className="crm-lembrete-label">📦 Quando o produto chegar</div>
                        <div className="crm-lembrete-text">{`Oi ${selected.nome.split(" ")[0]}! Boa notícia 🎉 O produto que você pediu (${selected.produto_interesse || "produto"}) chegou! Quer garantir o seu? Me fala!`}</div>
                        <button className="crm-lembrete-copy" onClick={() => navigator.clipboard.writeText(`Oi ${selected.nome.split(" ")[0]}! Boa notícia 🎉 O produto que você pediu (${selected.produto_interesse || "produto"}) chegou! Quer garantir o seu? Me fala!`)}>Copiar mensagem</button>
                      </div>
                    )}
                  </div>
                )}

                <button className="crm-del-btn" onClick={() => deleteCliente(selected.id)}>🗑 Remover do CRM</button>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
