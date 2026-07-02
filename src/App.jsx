import { useState, useRef, useEffect } from "react";
import mammoth from "mammoth";
import ProfilePage, { AGENTS } from "./components/ProfilePage";
import Login from "./components/Login";
import CRMPage from "./components/CRMPage";
import { API, authFetch, getToken, clearToken } from "./api";

const uid = () => Math.random().toString(36).slice(2);

const EXAMPLES = [
  "Me dá um diagnóstico do Ismael",
  "Compare os casos da imersão e diz o que eles têm em comum",
  "O que o Ismael precisa ouvir amanhã de manhã?",
  "Qual a bala de prata pra ele hoje?",
];

const IMERSAO_EVENTO = {
  data: "20/06/2026",
  nomes: ["Ismael", "Sandro", "Ana Paula", "Will", "Pedrita", "Breno", "Rafael", "Taty", "Gabriel"],
};

// Formata timestamp ISO do banco -> "dd/mm/aaaa"
function fmtDateBR(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return null; }
}
// Data da Imersão de um caso: event_date do banco (cross-device) > override localStorage > data de criação
function getImEventDate(id, createdAt, eventDate) {
  if (eventDate) { const br = isoToBR(String(eventDate).slice(0, 10)); if (br) return br; }
  try { const s = localStorage.getItem(`im_date_${id}`); if (s) return s; } catch {}
  return fmtDateBR(createdAt) || "Sem data";
}
// "aaaa-mm-dd" (input date) -> "dd/mm/aaaa"
function isoToBR(iso) {
  if (!iso || !iso.includes("-")) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseHandle(val) {
  if (!val) return "";
  const s = val.trim().replace(/\/$/, "");
  if (s.startsWith("@")) return s.slice(1);
  try {
    const u = new URL(s.includes("://") ? s : "https://" + s);
    return u.pathname.split("/").filter(Boolean)[0] || s;
  } catch { return s.replace("@", ""); }
}

function decodeTokenUsername(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).username || null; }
  catch { return null; }
}

export default function App() {
  // Auth
  const [authUser, setAuthUser] = useState(() => {
    const t = getToken(); return t ? (decodeTokenUsername(t) || "ok") : null;
  });

  function handleLogout() { clearToken(); setAuthUser(null); }

  if (!authUser) return <Login onLogin={(u) => setAuthUser(u)} />;

  return <AppMain username={authUser} onLogout={handleLogout} />;
}

function AppMain({ onLogout, username }) {
  const imersaoLabel   = username === 'galpao' ? 'Clientes'  : 'Imersão';
  const estoqueLabel   = username === 'galpao' ? 'Estoque'   : 'Conhecimento';
  const fontesTabLabel = username === 'galpao' ? 'Estoque'   : 'Fontes';
  async function apiFetch(url, options = {}) {
    const res = await authFetch(url, options);
    if (res.status === 401) { onLogout(); throw new Error("Sessão expirada. Faça login novamente."); }
    return res;
  }

  // Conversations
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messagesCache, setMessagesCache] = useState({});

  // UI state
  const [currentView, setCurrentView] = useState("chat");
  const [activeAgentId, setActiveAgentId] = useState("bora");
  const [agentNames, setAgentNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem("agentNames") || "{}"); } catch { return {}; }
  });
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [convMenuOpen, setConvMenuOpen] = useState(null);

  // Autocomplete de agentes com @
  const [agentSuggestions, setAgentSuggestions] = useState([]);
  const [agentSuggestionsOpen, setAgentSuggestionsOpen] = useState(false);

  const [appReady, setAppReady] = useState(false);

  // Panel (NotebookLM-style middle column)
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("fontes"); // "fontes" | "imersao"

  // Knowledge / Fontes
  const [knowledge, setKnowledge] = useState([]);
  const [produtoForm, setProdutoForm] = useState(false);
  const [produtoDraft, setProdutoDraft] = useState({ nome: "", quantidade: "" });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [ytLink, setYtLink] = useState("");
  const [addingYt, setAddingYt] = useState(false);
  const [ytPendingTitle, setYtPendingTitle] = useState(""); // título quando transcrição falha
  const [ytManualContent, setYtManualContent] = useState(""); // descrição manual
  const [knowTitle, setKnowTitle] = useState("");
  const [knowText, setKnowText] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const knowFileRef = useRef(null);

  // Imersão
  const [imersao, setImersao] = useState([]);
  const [imTitle, setImTitle] = useState("");
  const [imText, setImText] = useState("");
  const [imNotice, setImNotice] = useState("");
  const [imProcessing, setImProcessing] = useState(false);
  const [imDragging, setImDragging] = useState(false);
  const [imEventOpen, setImEventOpen] = useState(false);
  const [imEventOpenDates, setImEventOpenDates] = useState(new Set()); // controla quais datas estão abertas
  const [imEventDate, setImEventDate] = useState(() => new Date().toISOString().slice(0, 10)); // data escolhida ao adicionar (input date, YYYY-MM-DD)
  const [showNewImModal, setShowNewImModal] = useState(false); // modal para criar nova Imersão
  const [newImDate, setNewImDate] = useState(() => new Date().toISOString().slice(0, 10)); // data da nova Imersão
  const imFileRef = useRef(null);

  // Per-case expand & Instagram
  const [expandedImId, setExpandedImId] = useState(null);
  const [reunioesModal, setReunioesModal] = useState(null); // imersao entry
  const [expandedMeetings, setExpandedMeetings] = useState(new Set());
  const [igInputs, setIgInputs] = useState({});
  const [igInputOpen, setIgInputOpen] = useState(new Set());
  const [instagramPreviews, setInstagramPreviews] = useState({}); // { [id]: { loading, data, error } }
  const [igPressAnim, setIgPressAnim] = useState(new Set());
  const [igProfiles, setIgProfiles] = useState({}); // { [id]: [{url, profile}] }

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const latestAiMsgRef = useRef(null);

  const activeMessages = messagesCache[activeId] || [];
  const activeConversation = conversations.find(c => c.id === activeId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages, loading]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  useEffect(() => {
    if (Object.values(agentNames).some(Boolean)) {
      localStorage.setItem("agentNames", JSON.stringify(agentNames));
    }
  }, [agentNames]);

  useEffect(() => {
    if (imersao.length > 0) {
      const dates = Array.from(new Set(imersao.map(e => e.event_date || e.created_date).filter(Boolean)));
      if (dates.length > 0) {
        const sorted = dates.sort((a, b) => {
          const dateA = a.includes("-") ? a : (a.split("/").reverse().join("-"));
          const dateB = b.includes("-") ? b : (b.split("/").reverse().join("-"));
          return new Date(dateB) - new Date(dateA);
        });
        const firstDate = sorted[0].includes("-") ? sorted[0] : (sorted[0].split("/").reverse().join("-"));
        setImEventDate(firstDate);
      }
    }
  }, [imersao.length]);

  async function loadConversations() {
    try {
      console.log(`[LOAD] Carregando TODAS as conversas (compartilhadas entre agentes)`);
      // Carrega conversas de TODOS os agentes - sem filtro
      const convRes = await apiFetch(`${API}/api/conversations`).then(r => r.json()).catch(() => []);
      console.log(`[LOAD] ${convRes.length} conversas carregadas`);

      if (Array.isArray(convRes) && convRes.length > 0) {
        setConversations(convRes);
        // Se não tem conversa ativa, seleciona a primeira
        if (!activeId) {
          const first = convRes[0];
          setActiveId(first.id);
          const msgs = await apiFetch(`${API}/api/conversations/${first.id}/messages`).then(r => r.json()).catch(() => []);
          if (Array.isArray(msgs)) setMessagesCache(c => ({ ...c, [first.id]: msgs.map(mapMsg) }));
        }
      } else {
        console.log(`[LOAD] Nenhuma conversa, criando nova`);
        const nc = await createConvOnServer("Nova conversa", activeAgentId).catch(() => null);
        if (nc?.id) {
          setConversations([nc]);
          setActiveId(nc.id);
          setMessagesCache({ [nc.id]: [] });
        }
      }
    } catch (e) {
      console.error('[loadConversations] ERRO:', e);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const agentRes = await apiFetch(`${API}/api/agent-config`).then(r => r.json()).catch(() => ({}));
        const bootAgent = agentRes?.activeAgentType || 'bora';
        if (agentRes?.activeAgentType) setActiveAgentId(bootAgent);

        const [knowRes, imRes] = await Promise.all([
          apiFetch(`${API}/api/knowledge`).then(r => r.json()).catch(() => []),
          apiFetch(`${API}/api/imersao`).then(r => r.json()).catch(() => []),
        ]);

        if (Array.isArray(knowRes)) setKnowledge(knowRes.map(e => ({ ...e, active: e.active !== false })));

        if (Array.isArray(imRes)) {
          const profilesMap = {};
          const restored = imRes.map(e => {
            // Try new multi-profile format
            try {
              const arr = JSON.parse(localStorage.getItem(`ig_profiles_${e.id}`) || 'null');
              if (Array.isArray(arr) && arr.length > 0) {
                profilesMap[e.id] = arr;
                return { ...e, instagram_url: arr[0].url, instagram_profile: arr[0].profile || null };
              }
            } catch {}
            // Fall back to old single-profile format or DB value
            let igUrl = e.instagram_url;
            let igProfile = e.instagram_profile;
            if (!igUrl) {
              try {
                const s = JSON.parse(localStorage.getItem(`ig_${e.id}`) || 'null');
                if (s?.url) { igUrl = s.url; igProfile = s.profile || null; }
              } catch {}
            }
            if (igUrl) {
              profilesMap[e.id] = [{ url: igUrl, profile: igProfile || null }];
              localStorage.setItem(`ig_profiles_${e.id}`, JSON.stringify(profilesMap[e.id]));
            }
            return { ...e, instagram_url: igUrl || null, instagram_profile: igProfile || null };
          });
          setIgProfiles(profilesMap);
          setImersao(restored.map(e => ({ ...e, active: e.active !== false, created_date: getImEventDate(e.id, e.created_at, e.event_date) })));
          const previews = {};
          restored.forEach(e => {
            if (e.instagram_url && e.instagram_profile) {
              previews[e.id] = { loading: false, data: e.instagram_profile, error: null };
            }
          });
          if (Object.keys(previews).length > 0) setInstagramPreviews(previews);
        }

        // Carrega todas as conversas (compartilhadas entre todos os agentes)
        await loadConversations();
      } catch (e) { console.error(e); } finally { setAppReady(true); }
    })();
  }, []);

  async function handleAgentChange(agent) {
    console.log(`🧠 MUDANÇA DE AGENTE: ${activeAgentId} → ${agent.id}`);

    // Apenas muda o agente ativo - as conversas continuam as mesmas!
    // Cada agente é um "cérebro diferente" respondendo ao mesmo chat
    setActiveAgentId(agent.id);
    setInput("");
    setAttachments([]);
    setNotice("");

    console.log(`✅ Agente mudado para ${agent.id} - personalidade alterada`);
  }

  function mapMsg(m) {
    return { id: m.id || uid(), role: m.role, displayText: m.display_text || "", apiContent: m.api_content || m.display_text || "", files: Array.isArray(m.files) ? m.files : [] };
  }

  async function createConvOnServer(title, agentId) {
    const r = await apiFetch(`${API}/api/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, agent_id: agentId || activeAgentId }) });
    return r.json();
  }

  async function startNewChat() {
    const nc = await createConvOnServer("Nova conversa", activeAgentId).catch(() => null);
    if (!nc?.id) return;
    setConversations(cs => [nc, ...cs]);
    setActiveId(nc.id);
    setMessagesCache(c => ({ ...c, [nc.id]: [] }));
    setInput(""); setAttachments([]); setSidebarOpen(false);
  }

  async function switchConversation(id) {
    setActiveId(id); setSidebarOpen(false);
    if (!messagesCache[id]) {
      const msgs = await apiFetch(`${API}/api/conversations/${id}/messages`).then(r => r.json()).catch(() => []);
      if (Array.isArray(msgs)) setMessagesCache(c => ({ ...c, [id]: msgs.map(mapMsg) }));
    }
  }

  async function deleteConversation(id) {
    await apiFetch(`${API}/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    setMessagesCache(c => { const n = { ...c }; delete n[id]; return n; });
    if (activeId === id) {
      if (remaining.length > 0) {
        switchConversation(remaining[0].id);
      } else {
        const nc = await createConvOnServer("Nova conversa", activeAgentId).catch(() => null);
        if (nc?.id) { setConversations([nc]); setActiveId(nc.id); setMessagesCache({ [nc.id]: [] }); }
      }
    }
  }

  function openPanel(tab) {
    if (panelOpen && panelTab === tab) { setPanelOpen(false); }
    else { setPanelOpen(true); setPanelTab(tab); }
    setSidebarOpen(false);
  }

  // ── File helpers ─────────────────────────────────────────────────────────────
  function readAsText(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
  }
  function readAsDataURL(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
  }

  async function handleChatFiles(fileList) {
    const files = Array.from(fileList || []);
    setNotice("");
    for (const file of files) {
      const name = file.name, lower = name.toLowerCase(), type = file.type;
      if (type.startsWith("audio/") || type.startsWith("video/") || /\.(mp4|webm|mov|m4a|mp3|wav)$/.test(lower)) {
        setNotice("Use a aba Imersão para subir vídeos com transcrição Whisper."); continue;
      }
      try {
        if (lower.endsWith(".docx")) { const b = await file.arrayBuffer(); const o = await mammoth.extractRawText({ arrayBuffer: b }); setAttachments(p => [...p, { id: uid(), name, kind: "text", text: o.value, size: file.size }]); }
        else if (/\.(txt|md|vtt|srt|csv|json|log)$/.test(lower) || type.startsWith("text/")) { const t = await readAsText(file); setAttachments(p => [...p, { id: uid(), name, kind: "text", text: t, size: file.size }]); }
        else if (lower.endsWith(".pdf") || type === "application/pdf") { const d = await readAsDataURL(file); setAttachments(p => [...p, { id: uid(), name, kind: "pdf", data: d, size: file.size }]); }
        else if (type.startsWith("image/")) { const d = await readAsDataURL(file); setAttachments(p => [...p, { id: uid(), name, kind: "image", data: d, mediaType: type, size: file.size }]); }
        else setNotice(`Não reconheci "${name}".`);
      } catch { setNotice(`Não consegui ler "${name}".`); }
    }
  }

  // ── YouTube ──────────────────────────────────────────────────────────────────
  async function handleYoutubeAdd() {
    const url = ytLink.trim();
    if (!url || addingYt) return;
    setAddingYt(true);
    try {
      const res = await apiFetch(`${API}/api/youtube-info`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.requiresManualContent) {
        // Transcrição indisponível — pede ao usuário para colar a descrição
        setYtPendingTitle(data.title);
        setYtManualContent("");
        return;
      }
      const entry = await apiFetch(`${API}/api/knowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: data.title, content: data.transcript, source: "youtube" }) }).then(r => r.json());
      if (entry?.id) { setKnowledge(k => [{ ...entry, active: true }, ...k]); setYtLink(""); setShowAddMenu(false); }
    } catch (e) { alert("Erro: " + (e.message || "falha ao buscar YouTube")); }
    finally { setAddingYt(false); }
  }

  async function handleYoutubeManualSubmit() {
    const content = ytManualContent.trim();
    if (!content || !ytPendingTitle || addingYt) return;
    setAddingYt(true);
    try {
      const entry = await apiFetch(`${API}/api/knowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: ytPendingTitle, content, source: "youtube" }) }).then(r => r.json());
      if (entry?.id) {
        setKnowledge(k => [{ ...entry, active: true }, ...k]);
        setYtLink(""); setYtPendingTitle(""); setYtManualContent(""); setShowAddMenu(false);
      }
    } catch (e) { alert("Erro: " + (e.message || "falha ao salvar")); }
    finally { setAddingYt(false); }
  }

  // ── Knowledge CRUD ───────────────────────────────────────────────────────────
  async function addKnowledgeManual() {
    const c = knowText.trim();
    if (!c) return;
    const res = await apiFetch(`${API}/api/knowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: knowTitle.trim() || "Sem título", content: c, source: "manual" }) });
    const entry = await res.json();
    if (entry?.id) { setKnowledge(k => [{ ...entry, active: true }, ...k]); setKnowTitle(""); setKnowText(""); setShowManualForm(false); }
  }

  async function addProduto() {
    const nome = produtoDraft.nome.trim();
    if (!nome) return;
    const content = produtoDraft.quantidade.trim() || "";
    const res = await apiFetch(`${API}/api/knowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: nome, content, source: "produto" }) });
    const entry = await res.json();
    if (entry?.id) { setKnowledge(k => [{ ...entry, active: true }, ...k]); setProdutoDraft({ nome: "", quantidade: "" }); setProdutoForm(false); }
  }

  async function removeKnowledge(id) {
    await apiFetch(`${API}/api/knowledge/${id}`, { method: "DELETE" }).catch(() => {});
    setKnowledge(k => k.filter(e => e.id !== id));
  }

  function toggleKnowledge(id) { setKnowledge(k => k.map(e => e.id === id ? { ...e, active: !e.active } : e)); }
  function toggleAllKnowledge(on) { setKnowledge(k => k.map(e => ({ ...e, active: on }))); }

  async function handleKnowledgeFiles(fileList) {
    for (const file of Array.from(fileList || [])) {
      const lower = file.name.toLowerCase();
      let text = "";
      try {
        if (lower.endsWith(".docx")) { const b = await file.arrayBuffer(); text = (await mammoth.extractRawText({ arrayBuffer: b })).value; }
        else if (/\.(txt|md|vtt|srt|csv|json|log)$/.test(lower) || file.type.startsWith("text/")) text = await readAsText(file);
        else continue;
        if (text.trim()) {
          const entry = await apiFetch(`${API}/api/knowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: file.name, content: text.trim(), source: "file" }) }).then(r => r.json());
          if (entry?.id) setKnowledge(k => [{ ...entry, active: true }, ...k]);
        }
      } catch { /* skip */ }
    }
  }

  // ── Imersão CRUD ─────────────────────────────────────────────────────────────
  async function addImersao() {
    const c = imText.trim();
    if (!c) return;
    const res = await apiFetch(`${API}/api/imersao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: imTitle.trim() || "Caso sem nome", content: c, source: "manual", event_date: imEventDate || null }) });
    const entry = await res.json();
    if (entry?.id) {
      const dateBR = isoToBR(imEventDate);
      try { localStorage.setItem(`im_date_${entry.id}`, dateBR); } catch {}
      const entryWithDate = { ...entry, active: true, created_date: dateBR };
      setImersao(im => [entryWithDate, ...im]);
      setImTitle("");
      setImText("");
      setImNotice("success");
      setTimeout(() => setImNotice(""), 2500);
    }
  }

  function toggleImersao(id) { setImersao(im => im.map(e => e.id === id ? { ...e, active: !e.active } : e)); }
  function toggleAllImersao(on) { setImersao(im => im.map(e => ({ ...e, active: on }))); }

  async function createNewImDate() {
    if (!newImDate) return;
    try {
      const res = await apiFetch(`${API}/api/imersao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `Imersão — ${isoToBR(newImDate)}`, content: "", source: "marker", event_date: newImDate }) });
      const entry = await res.json();
      if (entry?.id) {
        const dateBR = isoToBR(newImDate);
        const entryWithDate = { ...entry, active: true, created_date: dateBR, event_date: newImDate };
        setImersao(im => [entryWithDate, ...im]);
        setImEventDate(newImDate);
        setShowNewImModal(false);
        setNewImDate(new Date().toISOString().slice(0, 10));
        setImNotice("success");
        setTimeout(() => setImNotice(""), 2500);
      } else {
        setImNotice("Erro ao criar Imersão");
        setTimeout(() => setImNotice(""), 3000);
      }
    } catch (err) {
      setImNotice("Erro ao conectar ao servidor");
      setTimeout(() => setImNotice(""), 3000);
    }
  }

  // Move um mentorado para outra Imersão (event_date), persistindo no banco
  async function moveImersaoToDate(caseId, isoDate) {
    if (!isoDate) return;
    const dateBR = isoToBR(isoDate);
    try { localStorage.setItem(`im_date_${caseId}`, dateBR); } catch {}
    setImersao(im => im.map(e => e.id === caseId ? { ...e, created_date: dateBR } : e));
    setExpandedImId(null);
    try {
      await apiFetch(`${API}/api/imersao/${caseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_date: isoDate }) });
    } catch { /* otimista — estado local já atualizado */ }
  }

  async function handleImersaoFiles(fileList) {
    setImNotice(""); setImProcessing(false);
    for (const file of Array.from(fileList || [])) {
      const lower = file.name.toLowerCase(), type = file.type;
      if (type.startsWith("audio/") || type.startsWith("video/") || /\.(mp4|webm|mov|m4a|mp3|wav)$/.test(lower)) {
        setImProcessing(true); setImNotice("Transcrevendo com Whisper… (vídeos longos podem levar alguns minutos)");
        try {
          const fd = new FormData(); fd.append("video", file);
          const r = await apiFetch(`${API}/api/upload-video`, { method: "POST", body: fd });
          const data = await r.json().catch(() => ({ error: `Erro ${r.status}` }));
          if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
          if (data.nomeMentorado || data.resumo) {
            const participantesLinha = Array.isArray(data.participantes) && data.participantes.length
              ? `Participantes: ${data.participantes.join(", ")}\n\n`
              : "";
            const text = participantesLinha + (data.resumo || "");
            if (expandedImId) {
              await appendMeeting(expandedImId, text);
            } else {
              setImTitle(data.nomeMentorado || file.name.replace(/\.[^.]+$/, ""));
              setImText(text);
              setImNotice("Transcrição pronta — revise e clique em Adicionar.");
            }
          } else setImNotice(data.error || "Erro ao transcrever.");
        } catch(err) { setImNotice(`Erro: ${err.message}`); }
        setImProcessing(false); continue;
      }
      let text = "";
      try {
        if (lower.endsWith(".docx")) { const b = await file.arrayBuffer(); text = (await mammoth.extractRawText({ arrayBuffer: b })).value; }
        else if (/\.(txt|md|vtt|srt|csv|json|log)$/.test(lower) || type.startsWith("text/")) text = await readAsText(file);
        else continue;
        if (text.trim()) {
          if (expandedImId) {
            await appendMeeting(expandedImId, text.trim());
          } else {
            setImTitle(file.name.replace(/\.[^.]+$/, ""));
            setImText(text.trim());
            setImNotice("Carregado! Revise e clique em Adicionar.");
          }
        }
      } catch { /* skip */ }
    }
  }

  async function appendMeeting(caseId, newText) {
    const target = imersao.find(e => e.id === caseId);
    if (!target) return;
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const header = `[Reunião adicionada em ${dateStr}]`;
    const separator = "\n\n---\n";
    const newContent = (target.content || "") + separator + header + "\n" + newText;
    setImNotice("Salvando reunião…");
    try {
      const res = await apiFetch(`${API}/api/imersao/${caseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newContent }) });
      const updated = await res.json();
      if (updated?.id) {
        setImersao(im => im.map(e => e.id === caseId ? { ...e, content: newContent } : e));
        // update modal if open
        if (reunioesModal?.id === caseId) setReunioesModal(prev => ({ ...prev, content: newContent }));
        setImNotice("success");
        setTimeout(() => setImNotice(""), 2500);
      } else setImNotice(updated?.error || "Erro ao salvar.");
    } catch { setImNotice("Erro ao salvar reunião."); }
  }

  function onImDrop(e) { e.preventDefault(); setImDragging(false); handleImersaoFiles(e.dataTransfer.files); }

  // ── Instagram ────────────────────────────────────────────────────────────────
  function triggerIgFetch(caseId, overrideHandle) {
    const handle = overrideHandle || (igInputs[caseId] || "").trim();
    if (!handle || handle.length < 2) return;
    setIgPressAnim(prev => { const n = new Set(prev); n.add(caseId); return n; });
    setTimeout(() => setIgPressAnim(prev => { const n = new Set(prev); n.delete(caseId); return n; }), 400);
    fetchInstagramPreview(caseId, parseHandle(handle));
  }

  async function fetchInstagramPreview(caseId, handle) {
    if (!handle || handle.length < 2) return;
    setInstagramPreviews(prev => ({ ...prev, [caseId]: { loading: true, data: null, error: null } }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75000);
    try {
      const res = await apiFetch(`${API}/api/instagram/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: handle }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Perfil não encontrado");
      setInstagramPreviews(prev => ({ ...prev, [caseId]: { loading: false, data: json, error: null } }));
    } catch (err) {
      clearTimeout(timeout);
      const msg = err.name === "AbortError"
        ? "Busca demorou demais. Clique em 'Tentar novamente'."
        : err.message;
      setInstagramPreviews(prev => ({ ...prev, [caseId]: { loading: false, data: null, error: msg } }));
    }
  }

  async function saveInstagramUrl(caseId, url, profileData) {
    const existing = igProfiles[caseId] || [];
    if (existing.some(p => p.url === url)) {
      setIgInputOpen(prev => { const n = new Set(prev); n.delete(caseId); return n; });
      return;
    }
    const next = [...existing, { url, profile: profileData || null }];
    localStorage.setItem(`ig_profiles_${caseId}`, JSON.stringify(next));
    setIgProfiles(prev => ({ ...prev, [caseId]: next }));
    setIgInputOpen(prev => { const n = new Set(prev); n.delete(caseId); return n; });
    setInstagramPreviews(p => { const n = { ...p }; delete n[caseId]; return n; });
    setIgInputs(i => { const n = { ...i }; delete n[caseId]; return n; });
    // Save primary profile to DB for backward compat
    try {
      await apiFetch(`${API}/api/imersao/${caseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instagram_url: next[0].url, instagram_profile: next[0].profile || null }) });
    } catch { /* optimistic */ }
  }

  // Wrappers pra compatibilidade com novo layout
  function addInstagram(caseId, input) {
    const val = (input || "").trim();
    if (!val) return;
    const url = val.startsWith("http") ? val : `https://www.instagram.com/${val}/`;
    saveInstagramUrl(caseId, url, null);
  }
  function removeInstagram(caseId, idx) { removeIgProfile(caseId, idx); }

  function removeIgProfile(caseId, idx) {
    const next = (igProfiles[caseId] || []).filter((_, i) => i !== idx);
    localStorage.setItem(`ig_profiles_${caseId}`, JSON.stringify(next));
    setIgProfiles(prev => ({ ...prev, [caseId]: next }));
    if (next.length === 0) {
      apiFetch(`${API}/api/imersao/${caseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instagram_url: null, instagram_profile: null }) }).catch(() => {});
    }
  }

  // ── Chat ──────────────────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading || !activeId) return;
    let fullText = text;
    attachments.forEach(a => { if (a.kind === "text") fullText += `\n\n--- ${a.name} ---\n${a.text}`; });
    const fileChips = attachments.map(a => ({ name: a.name, kind: a.kind }));
    const userMsg = { id: uid(), role: "user", displayText: text || fileChips[0]?.name || "", apiContent: fullText, files: fileChips };
    setMessagesCache(c => ({ ...c, [activeId]: [...(c[activeId] || []), userMsg] }));
    if ((messagesCache[activeId] || []).length === 0 && text) setConversations(cs => cs.map(c => c.id === activeId ? { ...c, title: text.slice(0, 40) } : c));
    setInput(""); setAttachments([]); setLoading(true); setNotice("");
    try {
      const activeImersao = imersao.filter(e => e.active !== false);
      const res = await apiFetch(`${API}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, message: fullText, apiContent: fullText, files: fileChips, mentoradoContext: activeImersao.map(c => { const profs = igProfiles[c.id] || []; const primary = profs[0] || null; return { id: c.id, title: c.title, content: c.content || "", instagram_url: c.instagram_url || primary?.url || null, instagram_profile: c.instagram_profile || primary?.profile || null, instagram_analysis: c.instagram_analysis || null, igProfiles: profs }; }), activeMentoradoId: expandedImId || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newId = data.messageId || uid();
      latestAiMsgRef.current = newId;
      setMessagesCache(c => ({ ...c, [activeId]: [...(c[activeId] || []), { id: newId, role: "assistant", displayText: data.text || "Deu um nó. Bora!", apiContent: data.text || "", files: [] }] }));
    } catch (e) {
      const errId = uid();
      latestAiMsgRef.current = errId;
      setMessagesCache(c => ({ ...c, [activeId]: [...(c[activeId] || []), { id: errId, role: "assistant", displayText: `Erro: ${e.message}. Servidor online?`, apiContent: "", files: [] }] }));
    } finally { setLoading(false); }
  }

  function handleInputChange(text) {
    setInput(text);

    // Detecta @mention de agentes
    const atIndex = text.lastIndexOf('@');
    if (atIndex !== -1) {
      const afterAt = text.substring(atIndex + 1).split(/\s/)[0]; // pega até o próximo espaço

      if (afterAt.length >= 1) {
        // Filtra agentes por nome ou id
        const filtered = AGENTS.filter(a =>
          a.name.toLowerCase().includes(afterAt.toLowerCase()) ||
          a.id.toLowerCase().includes(afterAt.toLowerCase())
        );

        setAgentSuggestions(filtered);
        setAgentSuggestionsOpen(filtered.length > 0);
      } else if (afterAt.length === 0 && atIndex === text.length - 1) {
        // Mostra todos os agentes se acabou de digitar @
        setAgentSuggestions(AGENTS);
        setAgentSuggestionsOpen(true);
      } else {
        setAgentSuggestionsOpen(false);
      }
    } else {
      setAgentSuggestionsOpen(false);
    }
  }

  function selectAgent(agentId) {
    const atIndex = input.lastIndexOf('@');
    const beforeAt = input.substring(0, atIndex);
    const agent = AGENTS.find(a => a.id === agentId);

    // Remove a mensagem e muda de agente
    setInput("");
    setAgentSuggestionsOpen(false);

    // Muda para o agente selecionado
    const selectedAgent = { id: agentId, name: agent.name };
    handleAgentChange(selectedAgent);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!appReady) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "Inter,sans-serif", color: "#7C7264" }}>Conectando ao servidor…</div>;

  const empty = activeMessages.length === 0;

  return (
    <div className="bora-root"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleChatFiles(e.dataTransfer.files); }}
    >
      <style>{CSS}</style>

      {/* ── Left Sidebar ── */}
      {currentView !== "profile" && currentView !== "crm" && <aside className={"side" + (sidebarOpen ? " open" : "")}>
        <div className="side-top">
          <div className="brand">
            <span className="brand-mark"><Bolt /></span>
            <span className="brand-name">Bora<span className="brand-dot">.</span></span>
          </div>
          <button className="new-btn" onClick={startNewChat}><span className="plus">+</span> Nova conversa</button>
          <button className={"know-btn" + (panelOpen && panelTab === "fontes" ? " know-btn-active" : "")} onClick={() => openPanel("fontes")}>
            <BookIcon /> {estoqueLabel} <span className="know-count">{knowledge.length}</span>
          </button>
          <button className={"know-btn" + (panelOpen && panelTab === "imersao" ? " know-btn-active" : "")} onClick={() => openPanel("imersao")}>
            <LayersIcon /> {imersaoLabel} <span className="know-count">{imersao.length}</span>
          </button>
          {username === 'galpao' && (
            <button className={"know-btn" + (currentView === "crm" ? " know-btn-active" : "")} onClick={() => { setCurrentView("crm"); setPanelOpen(false); setSidebarOpen(false); }}>
              <CheckIcon /> CRM
            </button>
          )}
        </div>
        <div className="conv-list" onClick={() => setConvMenuOpen(null)}>
          {conversations.map(c => (
            <div key={c.id} className={"conv" + (c.id === activeId ? " active" : "")}>
              <button className="conv-btn" onClick={() => switchConversation(c.id)}>
                <span className="conv-title">{c.title}</span>
              </button>
              <div className="conv-menu-wrap">
                <button
                  className="conv-dots"
                  onClick={e => { e.stopPropagation(); setConvMenuOpen(convMenuOpen === c.id ? null : c.id); }}
                >···</button>
                {convMenuOpen === c.id && (
                  <div className="conv-dropdown">
                    <button className="conv-drop-item conv-drop-delete" onClick={e => { e.stopPropagation(); deleteConversation(c.id); setConvMenuOpen(null); }}>🗑 Excluir</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="side-foot">
          <button
            className={"agent-card pf-settings-trigger" + (currentView === "profile" ? " pf-settings-active" : "")}
            onClick={() => { setCurrentView(currentView === "profile" ? "chat" : "profile"); setSidebarOpen(false); }}
          >
            <span className="agent-ava" style={{ background: AGENTS.find(a => a.id === activeAgentId)?.color || "var(--accent)" }}>
              <Bolt small />
            </span>
            <div>
              <div className="agent-name">{agentNames[activeAgentId] || AGENTS.find(a => a.id === activeAgentId)?.name || "Agente Bora"}</div>
              <div className="agent-sub">{AGENTS.find(a => a.id === activeAgentId)?.sub || "conselheiro do time CD Grupo"}</div>
            </div>
            <span className="pf-gear">⚙</span>
          </button>
          <p className="disclaimer">Inspirado nos frameworks de Alfredo Soares.</p>
        </div>
      </aside>}
      {sidebarOpen && currentView !== "profile" && currentView !== "crm" && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      {/* ── Middle Panel (NotebookLM style) ── */}
      {panelOpen && currentView !== "profile" && currentView !== "crm" && (
        <aside className="sources-side">
          <div className="sources-side-head">
            <div className="panel-tabs">
              <button className={"panel-tab" + (panelTab === "fontes" ? " active" : "")} onClick={() => setPanelTab("fontes")}>{fontesTabLabel}</button>
              <button className={"panel-tab" + (panelTab === "imersao" ? " active" : "")} onClick={() => setPanelTab("imersao")}>{imersaoLabel}</button>
            </div>
            <button className="sources-side-close" onClick={() => setPanelOpen(false)} title="Fechar">◨</button>
          </div>

          <div className="sources-side-body">

            {/* ── ESTOQUE (galpao) ── */}
            {panelTab === "fontes" && username === 'galpao' && (<>
              <button className="sources-add-btn" onClick={() => setProdutoForm(f => !f)}>
                <span className="plus">+</span> {produtoForm ? "Cancelar" : "Adicionar produto"}
              </button>

              {produtoForm && (
                <div className="manual-form">
                  <input
                    className="manual-input"
                    placeholder="Nome do produto *"
                    value={produtoDraft.nome}
                    autoFocus
                    onChange={e => setProdutoDraft(d => ({ ...d, nome: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addProduto()}
                  />
                  <input
                    className="manual-input"
                    placeholder="Quantidade  ex: 15 unidades, 2 caixas…"
                    value={produtoDraft.quantidade}
                    onChange={e => setProdutoDraft(d => ({ ...d, quantidade: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addProduto()}
                  />
                  <div className="manual-actions">
                    <button className="manual-add" style={{ marginLeft: 0, width: "100%" }} onClick={addProduto} disabled={!produtoDraft.nome.trim()}>
                      + Adicionar
                    </button>
                  </div>
                </div>
              )}

              <div className="sources-list-wrap">
                <div className="sources-list-action">
                  <span>Selecionar tudo</span>
                  <input type="checkbox" checked={knowledge.length > 0 && knowledge.every(e => e.active !== false)} onChange={e => toggleAllKnowledge(e.target.checked)} />
                </div>
                {knowledge.length === 0 && <div className="sources-empty">Nenhum produto no estoque ainda.</div>}
                {knowledge.map(e => (
                  <div key={e.id} className="sources-item prod-item">
                    <span className="sources-item-icon"><BoxIcon /></span>
                    <div className="prod-info">
                      <span className="prod-nome">{e.title}</span>
                      {e.content && <span className="prod-qtd">{e.content}</span>}
                    </div>
                    <button className="sources-item-del" onClick={() => removeKnowledge(e.id)} title="Remover">×</button>
                    <input type="checkbox" checked={e.active !== false} onChange={() => toggleKnowledge(e.id)} />
                  </div>
                ))}
              </div>
            </>)}

            {/* ── FONTES (outros usuários) ── */}
            {panelTab === "fontes" && username !== 'galpao' && (<>
              <button className="sources-add-btn" onClick={() => { setShowAddMenu(!showAddMenu); setShowManualForm(false); }}>
                <span className="plus">+</span> Adicionar fontes
              </button>

              {showAddMenu && (
                <div className="sources-add-menu">
                  <div className="sources-add-header">Cole um link do YouTube</div>
                  <div className="sources-add-input-wrap">
                    <span className="yt-globe">🌐</span>
                    <input
                      className="sources-add-input"
                      placeholder="https://youtube.com/watch?v=..."
                      value={ytLink}
                      onChange={e => { setYtLink(e.target.value); setYtPendingTitle(""); setYtManualContent(""); }}
                      onKeyDown={e => e.key === "Enter" && !ytPendingTitle && handleYoutubeAdd()}
                      disabled={addingYt}
                      autoFocus
                    />
                    {!ytPendingTitle && (
                      <button className="sources-add-submit" onClick={handleYoutubeAdd} disabled={addingYt || !ytLink.trim()}>
                        {addingYt ? "…" : "🔍"}
                      </button>
                    )}
                  </div>
                  {ytPendingTitle && (
                    <div className="yt-manual-wrap">
                      <div className="yt-manual-title">📹 <strong>{ytPendingTitle}</strong></div>
                      <div className="yt-manual-hint">Transcrição indisponível. Cole a descrição do vídeo:</div>
                      <textarea
                        className="yt-manual-textarea"
                        placeholder="Cole aqui a descrição ou conteúdo do vídeo..."
                        value={ytManualContent}
                        onChange={e => setYtManualContent(e.target.value)}
                        rows={5}
                        autoFocus
                      />
                      <div className="yt-manual-actions">
                        <button className="yt-manual-cancel" onClick={() => { setYtPendingTitle(""); setYtManualContent(""); }}>Cancelar</button>
                        <button className="yt-manual-submit" onClick={handleYoutubeManualSubmit} disabled={addingYt || !ytManualContent.trim()}>
                          {addingYt ? "…" : "Adicionar"}
                        </button>
                      </div>
                    </div>
                  )}
                  <button className="sources-add-manual-toggle" onClick={() => setShowManualForm(!showManualForm)}>
                    {showManualForm ? "▲ Ocultar texto manual" : "▼ Adicionar texto manual"}
                  </button>
                  {showManualForm && (
                    <div className="manual-form">
                      <input className="manual-input" placeholder="Título" value={knowTitle} onChange={e => setKnowTitle(e.target.value)} />
                      <textarea className="manual-textarea" placeholder="Cole o texto aqui…" value={knowText} onChange={e => setKnowText(e.target.value)} />
                      <div className="manual-actions">
                        <button className="manual-import" onClick={() => knowFileRef.current?.click()}><Clip /> Arquivo</button>
                        <button className="manual-add" onClick={addKnowledgeManual} disabled={!knowText.trim()}>+ Adicionar</button>
                      </div>
                      <input ref={knowFileRef} type="file" multiple accept=".txt,.md,.vtt,.srt,.csv,.json,.log,.docx" style={{ display: "none" }} onChange={e => { handleKnowledgeFiles(e.target.files); e.target.value = ""; }} />
                    </div>
                  )}
                </div>
              )}

              <div className="sources-list-wrap">
                <div className="sources-list-action">
                  <span>Selecionar tudo</span>
                  <input type="checkbox" checked={knowledge.length > 0 && knowledge.every(e => e.active !== false)} onChange={e => toggleAllKnowledge(e.target.checked)} />
                </div>
                {knowledge.length === 0 && <div className="sources-empty">Nenhuma fonte. Adicione um vídeo do YouTube ou texto.</div>}
                {knowledge.map(e => (
                  <div key={e.id} className="sources-item">
                    <span className="sources-item-icon">
                      {e.source === "youtube" ? <YtRedIcon /> : <FileIcon />}
                    </span>
                    <span className="sources-item-title" title={e.title}>{e.title}</span>
                    <button className="sources-item-del" onClick={() => removeKnowledge(e.id)} title="Remover">×</button>
                    <input type="checkbox" checked={e.active !== false} onChange={() => toggleKnowledge(e.id)} />
                  </div>
                ))}
              </div>
            </>)}

            {/* ── CLIENTES / WhatsApp (só galpao) ── */}
            {panelTab === "imersao" && username === 'galpao' && (<>
              <input ref={imFileRef} type="file" multiple accept=".txt,.md,.vtt,.srt,.csv,.json,.log,.docx" style={{ display: "none" }} onChange={e => { handleImersaoFiles(e.target.files); e.target.value = ""; }} />

              {imProcessing && (
                <div className="processing-anim">
                  <span className="proc-emoji">📄</span><span className="proc-pencil">✏️</span>
                  <div className="proc-text">{imNotice}</div>
                </div>
              )}
              {!imProcessing && imNotice === "success" && (
                <div className="success-anim">
                  <svg viewBox="0 0 52 52" className="success-svg"><circle className="success-circle" cx="26" cy="26" r="24" fill="none" /><path className="success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" /></svg>
                  <div className="success-text">Feito!</div>
                </div>
              )}
              {!imProcessing && imNotice && imNotice !== "success" && (
                <div className="im-notice">{imNotice}</div>
              )}

              {(imNotice === "success" || imTitle || imText) && (
                <div className="im-manual-add">
                  <input className="im-add-input" placeholder="Nome do cliente" value={imTitle} onChange={e => setImTitle(e.target.value)} />
                  <textarea className="im-add-textarea" placeholder="Resumo das conversas com o cliente…" value={imText} onChange={e => setImText(e.target.value)} />
                  <button className="im-add-btn" disabled={!imText.trim()} onClick={addImersao}>+ Adicionar cliente</button>
                </div>
              )}

              <div className="sources-list-wrap">
                <div className="sources-list-action">
                  <span>Selecionar tudo</span>
                  <input type="checkbox" checked={imersao.length > 0 && imersao.every(e => e.active !== false)} onChange={e => toggleAllImersao(e.target.checked)} />
                </div>
                {imersao.length === 0 && <div className="sources-empty">Nenhum cliente ainda. Os resumos do WhatsApp aparecerão aqui.</div>}
                {imersao.map(e => {
                  const expanded = expandedImId === e.id;
                  const resumo = (e.content || "").trim();
                  const resumoCurto = resumo.slice(0, 220);
                  const temMais = resumo.length > 220;

                  return (
                    <div key={e.id} className={"im-item-wrap" + (expanded ? " im-item-wrap--selected" : "")}>
                      <div className="sources-item">
                        <span className="sources-item-icon"><PersonIcon /></span>
                        <span
                          className="sources-item-title"
                          style={{ cursor: "pointer" }}
                          onClick={() => setExpandedImId(expanded ? null : e.id)}
                          title={expanded ? "Recolher" : "Ver resumo"}
                        >
                          {e.title}
                        </span>
                        <input type="checkbox" checked={e.active !== false} onChange={() => toggleImersao(e.id)} />
                      </div>

                      {expanded && resumo && (
                        <div className="cli-resumo">
                          <div className="cli-resumo-label">💬 Resumo das conversas</div>
                          <div className="cli-resumo-text">
                            {expandedMeetings.has(e.id) ? resumo : resumoCurto}
                            {temMais && !expandedMeetings.has(e.id) && (
                              <button className="meeting-expand" onClick={() => setExpandedMeetings(p => { const n = new Set(p); n.add(e.id); return n; })}>
                                Ver tudo ▼
                              </button>
                            )}
                            {temMais && expandedMeetings.has(e.id) && (
                              <button className="meeting-expand" onClick={() => setExpandedMeetings(p => { const n = new Set(p); n.delete(e.id); return n; })}>
                                Recolher ▲
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {expanded && !resumo && (
                        <div className="cli-resumo cli-resumo--vazio">Sem resumo ainda. O WhatsApp irá gerar automaticamente.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>)}

            {/* ── IMERSÃO (cdgrupo e outros) ── */}
            {panelTab === "imersao" && username !== 'galpao' && (<>
              <div
                className={"im-drop-zone" + (imDragging ? " drag" : "")}
                onClick={() => imFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setImDragging(true); }}
                onDragLeave={() => setImDragging(false)}
                onDrop={onImDrop}
              >
                <Clip />
                <span>
                  {expandedImId
                    ? `Suba a reunião de ${imersao.find(e => e.id === expandedImId)?.title || "mentorado"}`
                    : "Suba uma nova reunião"}
                </span>
              </div>

              {imProcessing && (
                <div className="processing-anim">
                  <span className="proc-emoji">📄</span><span className="proc-pencil">✏️</span>
                  <div className="proc-text">{imNotice}</div>
                </div>
              )}
              {!imProcessing && imNotice === "success" && (
                <div className="success-anim">
                  <svg viewBox="0 0 52 52" className="success-svg"><circle className="success-circle" cx="26" cy="26" r="24" fill="none" /><path className="success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" /></svg>
                  <div className="success-text">Feito!</div>
                </div>
              )}
              {!imProcessing && imNotice && imNotice !== "success" && (
                <div className="im-notice">{imNotice}</div>
              )}

              {(imNotice === "success" || imTitle || imText) && (
                <div className="im-manual-add">
                  <input className="im-add-input" placeholder="Nome do mentorado" value={imTitle} onChange={e => setImTitle(e.target.value)} />
                  <textarea className="im-add-textarea" placeholder="Cole a transcrição da reunião aqui…" value={imText} onChange={e => setImText(e.target.value)} />
                  <label className="im-date-label">
                    <span>Salvar na Imersão de:</span>
                    <select className="im-date-input im-date-select" value={imEventDate} onChange={e => setImEventDate(e.target.value)}>
                      {Array.from(new Set(imersao.map(e => e.event_date || e.created_date).filter(Boolean)))
                        .sort((a, b) => {
                          const dateA = a.includes("-") ? a : (a.split("/").reverse().join("-"));
                          const dateB = b.includes("-") ? b : (b.split("/").reverse().join("-"));
                          return new Date(dateB) - new Date(dateA);
                        })
                        .map(d => {
                          const iso = d.includes("-") ? d : (d.split("/").reverse().join("-"));
                          const display = d.includes("-") ? isoToBR(d) : d;
                          return <option key={iso} value={iso}>{display}</option>;
                        })
                      }
                    </select>
                  </label>
                  <button className="im-add-btn" disabled={!imText.trim()} onClick={addImersao}>+ Adicionar caso</button>
                  <button className="im-add-btn im-new-im-btn" onClick={() => setShowNewImModal(true)}>+ Nova Imersão</button>
                </div>
              )}

              <input ref={imFileRef} type="file" multiple accept=".txt,.md,.vtt,.srt,.csv,.json,.log,.docx,video/*,audio/*,.mp4,.m4a,.webm,.mov,.mp3,.wav" style={{ display: "none" }} onChange={e => { handleImersaoFiles(e.target.files); e.target.value = ""; }} />

              <div className={"sources-list-wrap" + (expandedImId ? " im-list-has-focus" : "")}>
                <div className="sources-list-action">
                  <span>Selecionar tudo</span>
                  <input type="checkbox" checked={imersao.length > 0 && imersao.every(e => e.active !== false)} onChange={e => toggleAllImersao(e.target.checked)} />
                </div>

                {/* Renderizar eventos agrupados por data de criação */}
                {imersao.length > 0 && (() => {
                  const byDate = {};
                  imersao.forEach(e => {
                    const date = e.created_date;
                    if (date && date !== "Sem data") { // Filtra apenas com data válida
                      if (!byDate[date]) byDate[date] = [];
                      byDate[date].push(e);
                    }
                  });
                  return Object.entries(byDate)
                    .sort(([dateA], [dateB]) => new Date(dateB.split("/").reverse().join("-")) - new Date(dateA.split("/").reverse().join("-")))
                    .map(([date, items]) => (
                      <div key={date} className="im-event-wrap">
                        <button
                          className="know-btn know-btn-active im-event-btn"
                          onClick={() => setImEventOpenDates(prev => {
                            const n = new Set(prev);
                            n.has(date) ? n.delete(date) : n.add(date);
                            return n;
                          })}
                        >
                          <LayersIcon small />
                          <span>Imersão — {date}</span>
                          <span className="know-count">{items.length}</span>
                        </button>
                        {imEventOpenDates.has(date) && (
                          <div className="im-event-expand">
                            {items.map(e => {
                              const expanded = expandedImId === e.id;
                              return (
                                <div key={e.id} className={"im-item-wrap" + (expanded ? " im-item-wrap--selected" : "")}>
                                  <div className="sources-item">
                                    <span className="sources-item-icon"><LayersIcon small /></span>
                                    <span
                                      className="sources-item-title"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => setExpandedImId(expanded ? null : e.id)}
                                    >
                                      {e.title}
                                    </span>
                                    <input type="checkbox" checked={e.active !== false} onChange={() => toggleImersao(e.id)} />
                                  </div>

                                  {expanded && (
                                    <div className="im-meet-row">
                                      <button className="im-meet-btn" onClick={() => setReunioesModal(e)} title="Ver reuniões">
                                        <MeetIcon />
                                      </button>
                                      {igProfiles[e.id] && igProfiles[e.id].length > 0 ? (
                                        <div className="ig-quick-list">
                                          {igProfiles[e.id].map((prof, idx) => (
                                            <div key={idx} className="ig-quick-item">
                                              {prof.profile && <img src={prof.profile} alt="IG" className="ig-avatar" />}
                                              <button className="ig-remove" onClick={() => removeInstagram(e.id, idx)} title="Remover">×</button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                      {igInputOpen.has(e.id) ? (
                                        <div className="ig-input-wrapper">
                                          <input
                                            type="text"
                                            placeholder="@usuario"
                                            className="ig-input-quick"
                                            autoFocus
                                            onKeyDown={ev => {
                                              if (ev.key === 'Enter') {
                                                addInstagram(e.id, ev.currentTarget.value);
                                                ev.currentTarget.value = '';
                                                setIgInputOpen(p => { const n = new Set(p); n.delete(e.id); return n; });
                                              }
                                            }}
                                            onBlur={() => setIgInputOpen(p => { const n = new Set(p); n.delete(e.id); return n; })}
                                          />
                                        </div>
                                      ) : (
                                        <button
                                          className="ig-icon-btn"
                                          onClick={() => setIgInputOpen(p => { const n = new Set(p); n.add(e.id); return n; })}
                                          title="Adicionar Instagram"
                                        >
                                          <InstagramIcon size={16} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ));
                })()}
              </div>
            </>)}

          </div>
        </aside>
      )}

      {/* ── CRM Page (full screen) ── */}
      {currentView === "crm" && (
        <CRMPage onClose={() => setCurrentView("chat")} />
      )}

      {/* ── Profile or Chat ── */}
      {currentView === "profile" ? (
        <ProfilePage
          onClose={() => setCurrentView("chat")}
          onLogout={onLogout}
          onStartSession={(template) => {
            setInput(template);
            setCurrentView("chat");
            setTimeout(() => taRef.current?.focus(), 100);
          }}
          onAgentChange={handleAgentChange}
          agentNames={agentNames}
          onAgentNamesChange={setAgentNames}
        />
      ) : currentView !== "crm" && <main className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>≡</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span className="topbar-title">{activeConversation?.title || "Nova conversa"}</span>
            <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>
              🧠 {agentNames[activeAgentId] || AGENTS.find(a => a.id === activeAgentId)?.name || "Agente Bora"}
            </span>
          </div>
        </header>
        <div className="scroll" ref={scrollRef}>
          {empty ? (
            <div className="hero">
              <span className="hero-mark"><Bolt /></span>
              <h1 className="hero-title">Bora! O que vamos resolver hoje?</h1>
              <p className="hero-sub">Pergunte sobre um mentorado, peça diagnóstico ou jogue a <strong>transcrição</strong> aqui.</p>
              <div className="chips">{EXAMPLES.map(ex => <button key={ex} className="chip" onClick={() => { setInput(ex); taRef.current?.focus(); }}>{ex}</button>)}</div>
            </div>
          ) : (
            <div className="thread">
              {activeMessages.map(m => (
                <div key={m.id} className={"row " + m.role}>
                  {m.role === "assistant" && <span className="msg-ava"><Bolt small /></span>}
                  <div className="bubble">
                    {m.files?.length > 0 && <div className="msg-files">{m.files.map((f, i) => <span key={i} className="msg-file"><FileIcon /> {f.name}</span>)}</div>}
                    {m.displayText && (
                      m.role === "assistant"
                        ? <AnimatedMessage text={m.displayText} animate={m.id === latestAiMsgRef.current} />
                        : <div className="msg-text">{renderText(m.displayText)}</div>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="row assistant"><span className="msg-ava"><Bolt small /></span><div className="bubble"><div className="typing"><span /><span /><span /> <em>analisando…</em></div></div></div>}
            </div>
          )}
        </div>
        <div className="composer-wrap">
          {notice && <div className="notice">{notice}</div>}
          <div className="composer">
            {attachments.length > 0 && <div className="att-row">{attachments.map(a => <span key={a.id} className="att"><FileIcon /> <span className="att-name">{a.name}</span><button className="att-x" onClick={() => setAttachments(p => p.filter(x => x.id !== a.id))}>×</button></span>)}</div>}
            <div className="input-line">
              <button className="attach" onClick={() => fileInputRef.current?.click()}><Clip /></button>
              <textarea ref={taRef} className="ta" rows={1} placeholder="Manda a real…" value={input} onChange={e => handleInputChange(e.target.value)} onKeyDown={onKeyDown} />
              <button className="send" disabled={loading || (!input.trim() && attachments.length === 0)} onClick={send}><Arrow /></button>
            </div>
            {agentSuggestionsOpen && (
              <div className="agent-suggestions">
                {agentSuggestions.map(agent => (
                  <button
                    key={agent.id}
                    className="agent-suggestion-item"
                    onClick={() => selectAgent(agent.id)}
                  >
                    <span className="emoji">{agent.emoji}</span>
                    <span className="name">@{agent.name}</span>
                  </button>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.vtt,.srt,.csv,.json,.log,.docx,.pdf,image/*" style={{ display: "none" }} onChange={e => { handleChatFiles(e.target.files); e.target.value = ""; }} />
          </div>
          <p className="foot-note">Aceita .txt, .vtt, .docx, .pdf e imagens.</p>
        </div>
        {dragging && <div className="dropzone"><div className="dropcard"><Clip big /><p>Solte aqui</p></div></div>}
      </main>}
      {/* ── Nova Imersão Modal ── */}
      {showNewImModal && (
        <div className="modal-overlay" onClick={() => setShowNewImModal(false)}>
          <div className="modal-box" onClick={ev => ev.stopPropagation()} style={{ maxWidth: "400px" }}>
            <div className="modal-head">
              <div className="modal-head-title">
                <span>Criar Nova Imersão</span>
              </div>
              <button className="modal-close" onClick={() => setShowNewImModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ gap: "12px", padding: "20px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)" }}>Data da Imersão:</span>
                <input type="date" value={newImDate} onChange={e => setNewImDate(e.target.value)} style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "8px", fontFamily: "inherit", fontSize: "13px" }} />
              </label>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button onClick={() => setShowNewImModal(false)} style={{ flex: 1, padding: "9px 14px", border: "1px solid var(--line)", background: "white", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}>Cancelar</button>
                <button onClick={createNewImDate} style={{ flex: 1, padding: "9px 14px", background: "var(--accent)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "700", fontFamily: "inherit" }}>Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Reuniões Modal ── */}
      {reunioesModal && (() => {
        const e = reunioesModal;
        // split meetings by separator added on future multi-meeting support
        const parts = (e.content || "").split(/\n\n---\n/);
        return (
          <div className="modal-overlay" onClick={() => setReunioesModal(null)}>
            <div className="modal-box" onClick={ev => ev.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-head-title">
                  <MeetIcon />
                  <span>Reuniões · {e.title}</span>
                </div>
                <button className="modal-close" onClick={() => setReunioesModal(null)}>×</button>
              </div>
              <div className="modal-body">
                {parts.map((text, idx) => {
                  // try to extract date header [Reunião adicionada em ...]
                  let dateLabel = idx === 0 && e.created_at
                    ? new Date(e.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
                    : `Reunião ${idx + 1}`;
                  let cleanText = text;
                  const dateMatch = text.match(/^\[Reunião adicionada em (.*?)\]\n([\s\S]*)/);
                  if (dateMatch) { dateLabel = dateMatch[1]; cleanText = dateMatch[2]; }

                  const meetingKey = `${e.id}-${idx}`;
                  const isOpen = expandedMeetings.has(meetingKey);
                  // summary = first 360 chars
                  const summary = cleanText.trim().slice(0, 360);
                  const hasFull = cleanText.trim().length > 360;

                  return (
                    <div key={idx} className="meeting-card">
                      <div className="meeting-card-head" onClick={() => setExpandedMeetings(prev => {
                        const n = new Set(prev); n.has(meetingKey) ? n.delete(meetingKey) : n.add(meetingKey); return n;
                      })}>
                        <div className="meeting-date"><MeetIcon />{dateLabel}</div>
                        <span className="meeting-chev">{isOpen ? "▲" : "▼"}</span>
                      </div>
                      {isOpen && (
                        <div className="meeting-content">
                          {summary}
                          {hasFull && !expandedMeetings.has(meetingKey + "-full") && (
                            <button className="meeting-expand" onClick={ev => { ev.stopPropagation(); setExpandedMeetings(prev => { const n = new Set(prev); n.add(meetingKey + "-full"); return n; }); }}>
                              Ver tudo ▼
                            </button>
                          )}
                          {expandedMeetings.has(meetingKey + "-full") && (
                            <span>{cleanText.trim().slice(360)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

// ── Text renderer ─────────────────────────────────────────────────────────────
function AnimatedMessage({ text, animate }) {
  const [count, setCount] = useState(animate ? 0 : text.length);
  const done = count >= text.length;

  useEffect(() => {
    if (!animate || done) return;
    const id = setTimeout(() => setCount(c => Math.min(c + 22, text.length)), 16);
    return () => clearTimeout(id);
  }, [count, animate, done, text.length]);

  const visible = done ? text : text.slice(0, count);
  return (
    <div className="msg-text">
      {renderText(visible)}
      {!done && <span className="msg-cursor" />}
    </div>
  );
}

function renderText(text) {
  const lines = text.split("\n"), out = [];
  let list = [];
  const flush = k => { if (list.length) { out.push(<ul key={"u" + k}>{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>); list = []; } };
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (/^[-*•]\s+/.test(t)) { list.push(t.replace(/^[-*•]\s+/, "")); return; }
    if (/^\d+[.)]\s+/.test(t)) { list.push(t.replace(/^\d+[.)]\s+/, "")); return; }
    flush(i);
    if (!t) out.push(<div key={"s" + i} style={{ height: 6 }} />);
    else if (/^#{1,3}\s/.test(t)) out.push(<p key={"h" + i} style={{ fontWeight: 700, marginBottom: 4 }}>{inline(t.replace(/^#{1,3}\s/, ""))}</p>);
    else out.push(<p key={"p" + i}>{inline(t)}</p>);
  });
  flush("e");
  return out;
}
function inline(s) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>);
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function Bolt({ small }) {
  const s = small ? 14 : 22;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" /></svg>;
}
function Arrow() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Clip({ big }) {
  const s = big ? 34 : 18;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M21 11.5l-8.5 8.5a5 5 0 01-7-7L13 4.5a3.3 3.3 0 014.7 4.7l-8.6 8.6a1.6 1.6 0 01-2.3-2.3l7.8-7.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function FileIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
function BookIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M4 19.5A2.5 2.5 0 016.5 22H20" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
function LayersIcon({ small }) {
  const s = small ? 14 : 18;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M3 12l9 5 9-5M3 17l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function BoxIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
function PersonIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
function MeetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="13" height="12" rx="2" fill="#00897B"/>
      <path d="M15 10l5-3v10l-5-3V10z" fill="#00BFA5"/>
    </svg>
  );
}
function YtRedIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24"><path d="M21.582 6.186a2.68 2.68 0 00-1.884-1.888C18.036 3.84 12 3.84 12 3.84s-6.036 0-7.698.458a2.68 2.68 0 00-1.884 1.888C1.96 7.848 1.96 12 1.96 12s0 4.152.458 5.814a2.68 2.68 0 001.884 1.888C5.964 20.16 12 20.16 12 20.16s6.036 0 7.698-.458a2.68 2.68 0 001.884-1.888C22.04 16.152 22.04 12 22.04 12s0-4.152-.458-5.814z" fill="red" /><path d="M9.96 15.63l5.988-3.63-5.988-3.63v7.26z" fill="#fff" /></svg>;
}
function InstagramIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig)" strokeWidth="1.8" /><circle cx="12" cy="12" r="4.5" stroke="url(#ig)" strokeWidth="1.8" /><circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig)" /><defs><linearGradient id="ig" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop stopColor="#f09433" /><stop offset=".25" stopColor="#e6683c" /><stop offset=".5" stopColor="#dc2743" /><stop offset=".75" stopColor="#cc2366" /><stop offset="1" stopColor="#bc1888" /></linearGradient></defs></svg>;
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&display=swap');
*{box-sizing:border-box;}
.bora-root{--bg:#FBF8F3;--ink:#1C1813;--muted:#7C7264;--line:#EBE3D7;--accent:#F0531C;--accent-soft:#FFE7DC;--side:#17120E;--side-soft:#241C15;--cream:#F3ECE1;--surface:#ffffff;--border:#EBE3D7;display:flex;height:100vh;width:100%;background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden;}

.side{width:252px;flex-shrink:0;background:var(--side);color:var(--cream);display:flex;flex-direction:column;padding:16px 14px;gap:14px;}
.side-top{display:flex;flex-direction:column;gap:10px;}
.brand{display:flex;align-items:center;gap:9px;padding:4px 4px 2px;}
.brand-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--accent);color:#fff;}
.brand-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;letter-spacing:-.5px;color:var(--cream);}
.brand-dot{color:var(--accent);}
.new-btn{display:flex;align-items:center;gap:8px;background:transparent;color:var(--cream);border:1px solid #3A2F24;border-radius:11px;padding:10px 13px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:.15s;}
.new-btn:hover{background:var(--side-soft);border-color:#4a3c2d;}
.plus{font-size:18px;line-height:0;color:var(--accent);}
.know-btn{display:flex;align-items:center;gap:8px;background:var(--side-soft);color:var(--cream);border:1px solid #3A2F24;border-radius:11px;padding:10px 13px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:.15s;}
.know-btn:hover{border-color:var(--accent);}
.know-btn svg{color:var(--accent);}
.know-btn.know-btn-active{background:var(--accent);border-color:var(--accent);color:#fff;}
.know-btn.know-btn-active svg{color:#fff;}
.know-count{margin-left:auto;background:var(--accent);color:#fff;font-size:11px;font-weight:700;min-width:20px;height:20px;padding:0 6px;border-radius:10px;display:grid;place-items:center;}
.know-btn.know-btn-active .know-count{background:rgba(255,255,255,.3);}
.conv-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:2px;margin:0 -4px;padding:0 4px;}
.conv{display:flex;align-items:center;border-radius:9px;transition:.12s;position:relative;}
.conv:hover{background:var(--side-soft);}
.conv.active{background:var(--side-soft);}
.conv-btn{flex:1;text-align:left;background:transparent;border:none;color:#C9BEAE;padding:9px 11px;font-size:13.5px;cursor:pointer;font-family:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:.12s;min-width:0;}
.conv:hover .conv-btn,.conv.active .conv-btn{color:var(--cream);}
.conv.active .conv-btn{color:#fff;}
.conv-menu-wrap{position:relative;flex-shrink:0;}
.conv-dots{background:none;border:none;color:#9c907f;cursor:pointer;font-size:16px;letter-spacing:1px;line-height:1;padding:4px 6px;border-radius:6px;opacity:0;transition:opacity .14s,background .14s,color .14s;}
.conv:hover .conv-dots,.conv.active .conv-dots{opacity:1;}
.conv-dots:hover{background:rgba(255,255,255,.08);color:var(--cream);}
.conv-dropdown{position:absolute;right:0;top:calc(100% + 4px);background:#2a1f16;border:1px solid #3d2e22;border-radius:9px;padding:5px;min-width:130px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:convPop .13s ease-out;}
@keyframes convPop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.conv-drop-item{width:100%;background:none;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--cream);padding:8px 12px;text-align:left;border-radius:6px;transition:background .12s;}
.conv-drop-item:hover{background:rgba(255,255,255,.06);}
.conv-drop-delete{color:#f87171;}
.conv-drop-delete:hover{background:rgba(248,113,113,.12);}
.side-foot{border-top:1px solid #2c2218;padding-top:12px;display:flex;flex-direction:column;gap:9px;}
.agent-card{display:flex;align-items:center;gap:10px;}
.agent-ava{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--accent);color:#fff;flex-shrink:0;}
.agent-name{font-weight:700;font-size:13.5px;color:var(--cream);}
.agent-sub{font-size:11.5px;color:#9c907f;}
.disclaimer{font-size:10.5px;line-height:1.4;color:#7d7263;margin:0;}
.scrim{display:none;}

.sources-side{width:300px;flex-shrink:0;background:var(--bg);border-right:1px solid var(--line);display:flex;flex-direction:column;overflow:hidden;}
.sources-side-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid var(--line);flex-shrink:0;}
.panel-tabs{display:flex;gap:4px;background:#EDEAE3;border-radius:10px;padding:3px;}
.panel-tab{background:transparent;border:none;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--muted);transition:.14s;}
.panel-tab.active{background:#fff;color:var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.1);}
.sources-side-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);padding:4px;line-height:1;}
.sources-side-close:hover{color:var(--ink);}
.sources-side-body{flex:1;overflow-y:auto;padding:12px 12px 20px;display:flex;flex-direction:column;gap:8px;}

.sources-add-btn{display:flex;align-items:center;gap:8px;background:var(--accent);color:#fff;border:none;border-radius:11px;padding:11px 14px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;}
.sources-add-btn:hover{background:#d8430f;}
.sources-add-menu{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:9px;}
.sources-add-header{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;}
.sources-add-input-wrap{display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:2px 8px 2px 10px;}
.yt-globe{font-size:16px;line-height:1;}
.sources-add-input{flex:1;border:none;background:transparent;font-family:inherit;font-size:13px;padding:7px 0;color:var(--ink);outline:none;}
.sources-add-submit{background:none;border:none;cursor:pointer;font-size:16px;padding:4px;line-height:1;}
.sources-add-submit:disabled{opacity:.5;cursor:not-allowed;}
.sources-add-manual-toggle{background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;text-align:left;padding:2px 0;font-family:inherit;}
.sources-add-manual-toggle:hover{color:var(--accent);}
.manual-form{display:flex;flex-direction:column;gap:7px;}
.manual-input{border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-family:inherit;font-size:13px;color:var(--ink);outline:none;}
.manual-input:focus{border-color:var(--accent);}
.manual-textarea{border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-family:inherit;font-size:12.5px;line-height:1.45;min-height:80px;resize:vertical;color:var(--ink);outline:none;}
.manual-textarea:focus{border-color:var(--accent);}
.manual-actions{display:flex;gap:8px;}
.manual-import{display:flex;align-items:center;gap:5px;background:var(--cream);border:1px solid var(--line);border-radius:8px;padding:7px 11px;font-size:12.5px;cursor:pointer;font-family:inherit;color:var(--ink);}
.manual-import:hover{border-color:var(--accent);color:var(--accent);}
.manual-add{margin-left:auto;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;}
.manual-add:disabled{background:#e7ddd0;color:#b6ab9b;cursor:not-allowed;}

.sources-list-wrap{display:flex;flex-direction:column;gap:1px;}
.sources-list-action{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--muted);padding:6px 0;border-bottom:1px solid var(--line);margin-bottom:4px;}
.sources-empty{font-size:12.5px;color:var(--muted);text-align:center;padding:16px 0;line-height:1.5;}
.sources-item{display:flex;align-items:center;gap:8px;padding:8px 6px;border-radius:8px;}
.sources-item:hover{background:var(--cream);}
.sources-item-icon{flex-shrink:0;display:grid;place-items:center;color:var(--muted);}
.sources-item-title{flex:1;font-size:13px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink);}
.sources-item-del{background:none;border:none;font-size:16px;color:var(--muted);cursor:pointer;padding:0 3px;line-height:1;opacity:0;}
.sources-item:hover .sources-item-del{opacity:1;}
.sources-item-del:hover{color:var(--accent);}

/* Clientes — resumo de conversa (só galpao) */
.cli-resumo{background:var(--cream);border-radius:8px;padding:10px 12px;margin:2px 0 6px;display:flex;flex-direction:column;gap:5px;}
.cli-resumo--vazio{color:var(--muted);font-size:12px;font-style:italic;}
.cli-resumo-label{font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;}
.cli-resumo-text{font-size:12.5px;color:var(--ink);line-height:1.55;white-space:pre-wrap;word-break:break-word;}

/* Estoque — produto item */
.prod-item{align-items:center;}
.prod-info{flex:1;display:flex;flex-direction:column;gap:1px;min-width:0;}
.prod-nome{font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.prod-qtd{font-size:11.5px;color:var(--muted);}

/* Imersão item — selected card */
.im-item-wrap{border-radius:10px;transition:.15s;}
.im-item-wrap--selected{background:var(--surface);border-left:4px solid var(--accent);border-radius:0 10px 10px 0;padding:2px 8px 6px 6px;margin:3px 0;box-shadow:0 2px 16px rgba(240,83,28,.1);}
.im-item-wrap--selected>.sources-item{padding-left:0;}
.im-item-wrap--selected>.sources-item:hover{background:transparent;}
.im-item-wrap--selected .sources-item-title{color:var(--accent);font-weight:700;font-size:13.5px;}
.im-item-wrap--selected .im-expand{background:transparent;border:none;border-top:1px solid var(--line);border-radius:0;margin:0 0 2px;padding:8px 0 0;}
.im-item-wrap--selected .im-meet-row{padding:4px 0 0;}
.im-focus-badge{font-size:10px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:5px;padding:2px 6px;white-space:nowrap;flex-shrink:0;letter-spacing:.3px;}
.im-list-has-focus .im-item-wrap:not(.im-item-wrap--selected) .sources-item-title{color:var(--muted);}
.im-list-has-focus .im-item-wrap:not(.im-item-wrap--selected) .sources-item-icon{opacity:.4;}

/* Imersão — card do evento passado (agrupa vários mentorados) */
.im-event-wrap{margin:0 0 10px;}
.im-event-btn{width:100%;justify-content:flex-start;}
.im-event-expand{background:var(--surface);border:1px solid var(--line);border-radius:8px;margin-top:8px;padding:6px 8px 8px;display:flex;flex-direction:column;gap:2px;}
.im-event-name-row{display:flex;align-items:center;gap:8px;padding:6px 6px;border-radius:8px;font-size:13px;color:var(--ink);}
.im-event-name-row:hover{background:var(--cream);}
.im-event-name-row svg{color:var(--muted);flex-shrink:0;}
.im-event-missing{margin-left:auto;font-size:10.5px;color:var(--muted);font-style:italic;flex-shrink:0;}

.im-drop-zone{display:flex;align-items:center;gap:8px;background:#fff;border:2px dashed var(--line);border-radius:11px;padding:12px 14px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;transition:.15s;}
.im-drop-zone:hover,.im-drop-zone.drag{border-color:var(--accent);color:var(--accent);}
.processing-anim{display:flex;align-items:center;gap:10px;padding:10px;background:var(--accent-soft);border-radius:10px;font-size:13px;color:var(--accent);}
.proc-emoji{font-size:18px;}
.proc-pencil{font-size:14px;animation:bounce 1s infinite;}
.proc-text{flex:1;}
.im-notice{font-size:12.5px;color:var(--accent);background:var(--accent-soft);padding:8px 11px;border-radius:9px;}
.success-anim{display:flex;align-items:center;gap:10px;padding:10px;background:#f0fdf4;border-radius:10px;}
.success-svg{width:32px;height:32px;}
.success-circle{stroke:#22c55e;stroke-width:3;stroke-dasharray:151;stroke-dashoffset:0;animation:strokeIn .5s ease-out;}
.success-check{stroke:#22c55e;stroke-width:3;stroke-dasharray:50;stroke-dashoffset:0;animation:strokeIn .5s .3s ease-out both;}
@keyframes strokeIn{from{stroke-dashoffset:151}to{stroke-dashoffset:0}}
.success-text{font-size:13px;font-weight:700;color:#166534;}
.im-manual-add{display:flex;flex-direction:column;gap:7px;animation:popIn .3s ease-out;}
.im-add-input{border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-family:inherit;font-size:13px;color:var(--ink);outline:none;}
.im-add-input:focus{border-color:var(--accent);}
.im-add-textarea{border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-family:inherit;font-size:12.5px;line-height:1.45;min-height:80px;resize:vertical;color:var(--ink);outline:none;}
.im-add-textarea:focus{border-color:var(--accent);}
.im-add-btn{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
.im-add-btn:disabled{background:#e7ddd0;color:#b6ab9b;cursor:not-allowed;}
.im-new-im-btn{background:transparent;color:var(--accent);border:1px solid var(--accent);margin-top:8px;}
.im-new-im-btn:hover{background:var(--accent-soft);}
.im-date-label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;color:var(--muted);}
.im-date-input{border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-family:inherit;font-size:12.5px;color:var(--ink);outline:none;}
.im-date-input:focus{border-color:var(--accent);}
.im-date-select{padding:6px 9px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:12.5px;color:var(--ink);outline:none;background:white;cursor:pointer;}
.im-date-select:focus{border-color:var(--accent);}
.im-date-select option{padding:8px;}
.im-date-chips{display:flex;flex-wrap:wrap;gap:5px;}
.im-date-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit;transition:.15s;}
.im-date-chip:hover{border-color:var(--accent);color:var(--accent);}
.ig-quick-list{display:flex;gap:4px;flex-wrap:wrap;}
.ig-quick-item{display:flex;align-items:center;gap:3px;}
.ig-avatar{width:24px;height:24px;border-radius:50%;object-fit:cover;}
.ig-remove{background:none;border:none;color:var(--muted);cursor:pointer;font-weight:700;padding:0 2px;font-family:inherit;font-size:14px;}
.ig-remove:hover{color:var(--accent);}
.ig-icon-btn{background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 4px;display:flex;align-items:center;justify-content:center;transition:.15s;}
.ig-icon-btn:hover{color:var(--accent);}
.ig-input-wrapper{display:flex;align-items:center;gap:4px;padding:0 4px;}
.ig-input-quick{flex:1;border:1px solid var(--line);border-radius:6px;padding:4px 6px;font-family:inherit;font-size:12px;color:var(--ink);outline:none;}
.ig-input-quick:focus{border-color:var(--accent);}

.im-expand{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin:3px 0 6px 0;display:flex;flex-direction:column;gap:8px;}
.ig-row{display:flex;flex-direction:column;align-items:center;gap:8px;}
.ig-icon-wrap{flex-shrink:0;}
.ig-handle-row{display:flex;align-items:center;gap:6px;width:100%;background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:5px 10px;}
.ig-handle-text{flex:1;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ig-change-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:2px 4px;flex-shrink:0;}
.ig-change-btn:hover{color:var(--accent);}
.ig-input-wrap{width:100%;display:flex;align-items:center;border:1px solid var(--line);border-radius:7px;background:var(--bg);overflow:hidden;}
.ig-at{padding:5px 2px 5px 8px;font-size:12.5px;color:var(--muted);font-weight:600;user-select:none;}
.ig-input{flex:1;border:none;background:transparent;font-family:inherit;font-size:12.5px;padding:5px 4px 5px 2px;color:var(--ink);outline:none;}
.ig-search-btn{border:none;background:var(--accent);color:#fff;font-size:13px;padding:4px 10px;cursor:pointer;border-radius:0 5px 5px 0;line-height:1;flex-shrink:0;}
.ig-search-btn:hover{opacity:0.85;}
.ig-msg{font-size:11.5px;color:#166534;white-space:nowrap;}
.im-transcript-row{display:flex;align-items:center;}
.im-transcript-btn{display:inline-flex;align-items:center;gap:5px;background:none;border:1px solid var(--line);border-radius:7px;padding:5px 10px;font-size:11.5px;color:var(--muted);cursor:pointer;font-family:inherit;transition:.14s;}
.im-transcript-btn:hover,.im-transcript-btn.open{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
.im-snippet-full{font-size:11.5px;color:var(--muted);line-height:1.6;word-break:break-word;white-space:pre-wrap;max-height:280px;overflow-y:auto;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 12px;animation:popIn .2s ease-out;}

/* Instagram orbit animation */
.ig-orbit{position:absolute;top:50%;left:50%;width:46px;height:46px;margin:-23px 0 0 -23px;pointer-events:none;animation:igOrbit 1.1s linear infinite;}
.ig-ball{position:absolute;top:0;left:50%;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:linear-gradient(135deg,#f09433,#bc1888);box-shadow:0 0 6px rgba(188,24,136,.5);}
@keyframes igOrbit{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.ig-press{animation:igPress .4s ease-out;}
@keyframes igPress{0%{transform:scale(1)}30%{transform:scale(.78)}70%{transform:scale(1.12)}100%{transform:scale(1)}}

/* Instagram preview card */
.ig-preview-card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;animation:popIn .2s ease-out;width:100%;}
.ig-preview-error{font-size:12px;color:#dc2743;}
.ig-preview-body{display:flex;align-items:flex-start;gap:9px;}
.ig-preview-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;}
.ig-preview-info{flex:1;min-width:0;}
.ig-preview-username{font-weight:700;font-size:12.5px;color:var(--ink);display:flex;align-items:center;gap:4px;}
.ig-verified{color:#1d9bf0;font-size:11px;}
.ig-preview-name{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ig-preview-stats{font-size:11px;color:var(--muted);margin-top:2px;}
.ig-preview-actions{display:flex;flex-direction:column;gap:4px;flex-shrink:0;}
.ig-btn-use{font-size:11px;background:var(--accent);color:#fff;border:none;border-radius:7px;padding:5px 9px;cursor:pointer;font-weight:600;font-family:inherit;}
.ig-btn-use:hover{background:#d8430f;}
.ig-btn-saved{font-size:11px;background:#22c55e;color:#fff;border:none;border-radius:7px;padding:5px 9px;font-weight:600;cursor:default;font-family:inherit;}
.ig-btn-close{font-size:11px;background:none;border:1px solid var(--line);border-radius:7px;padding:4px 9px;cursor:pointer;color:var(--muted);font-family:inherit;}
.ig-btn-close:hover{border-color:var(--accent);color:var(--accent);}
.ig-btn-disconnect{border-color:#fca5a5;color:#dc2626;}
.ig-btn-disconnect:hover{border-color:#dc2626;background:#fef2f2;}

/* Google Meet button */
.im-meet-row{display:flex;justify-content:flex-end;padding:2px 0 0;}
.im-meet-btn{display:inline-flex;align-items:center;justify-content:center;background:none;border:1px solid var(--line);border-radius:8px;padding:5px 7px;cursor:pointer;transition:.14s;}
.im-meet-btn:hover{border-color:#00897B;background:#f0fdf4;}

/* Reuniões modal */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal-box{background:#fff;width:100%;max-width:560px;max-height:82vh;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.22);animation:popIn .25s ease-out;}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line);flex-shrink:0;}
.modal-head-title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:15px;color:var(--ink);}
.modal-close{background:none;border:none;font-size:22px;cursor:pointer;color:var(--muted);line-height:1;padding:0 2px;}
.modal-close:hover{color:var(--ink);}
.modal-body{overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px;}
.meeting-card{border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.meeting-card-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;cursor:pointer;user-select:none;background:#fff;}
.meeting-card-head:hover{background:var(--cream);}
.meeting-date{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;color:var(--ink);}
.meeting-chev{font-size:10px;color:var(--muted);}
.meeting-content{padding:12px 16px;font-size:13px;color:var(--muted);line-height:1.65;white-space:pre-wrap;word-break:break-word;border-top:1px solid var(--line);background:#fafaf8;}
.meeting-expand{display:block;margin-top:10px;background:none;border:none;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;padding:0;}
.meeting-expand:hover{text-decoration:underline;}

.main{flex:1;display:flex;flex-direction:column;min-width:0;position:relative;}
.topbar{height:54px;display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--line);background:rgba(251,248,243,.85);backdrop-filter:blur(6px);flex-shrink:0;}
.hamburger{display:none;background:none;border:none;font-size:24px;cursor:pointer;color:var(--ink);line-height:1;}
.topbar-title{font-weight:600;font-size:14px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.scroll{flex:1;overflow-y:auto;padding:8px 0 20px;}
.hero{max-width:640px;margin:0 auto;padding:56px 24px 24px;text-align:center;}
.hero-mark{display:inline-grid;place-items:center;width:54px;height:54px;border-radius:16px;background:var(--accent);color:#fff;margin-bottom:20px;box-shadow:0 10px 30px rgba(240,83,28,.28);}
.hero-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:32px;line-height:1.08;letter-spacing:-1px;margin:0 0 12px;}
.hero-sub{font-size:15px;line-height:1.55;color:var(--muted);margin:0 auto 26px;max-width:500px;}
.hero-sub strong{color:var(--ink);}
.chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.chip{background:#fff;border:1px solid var(--line);border-radius:13px;padding:11px 14px;font-size:13.5px;color:var(--ink);cursor:pointer;font-family:inherit;text-align:left;max-width:300px;transition:.14s;line-height:1.35;}
.chip:hover{border-color:var(--accent);background:var(--accent-soft);transform:translateY(-1px);}
.thread{max-width:720px;margin:0 auto;padding:22px 24px;display:flex;flex-direction:column;gap:18px;}
.row{display:flex;gap:12px;align-items:flex-start;}
.row.user{justify-content:flex-end;}
.msg-ava{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;flex-shrink:0;margin-top:2px;}
.bubble{max-width:82%;}
.row.user .bubble{background:var(--side);color:var(--cream);padding:12px 16px;border-radius:18px 18px 4px 18px;}
.row.assistant .bubble{background:transparent;padding-top:3px;}
.msg-text{font-size:15px;line-height:1.62;}
.msg-cursor{display:inline-block;width:2px;height:.9em;background:var(--accent);border-radius:1px;margin-left:2px;vertical-align:text-bottom;animation:cursorBlink .55s step-start infinite;}
@keyframes cursorBlink{0%,100%{opacity:1}50%{opacity:0}}
.msg-text p{margin:0 0 9px;}
.msg-text p:last-child{margin-bottom:0;}
.msg-text ul{margin:6px 0 10px;padding-left:20px;}
.msg-text li{margin:3px 0;line-height:1.55;}
.msg-text strong{font-weight:700;}
.row.assistant .msg-text strong{color:var(--accent);}
.msg-files{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
.msg-file{display:inline-flex;align-items:center;gap:5px;font-size:12px;background:rgba(255,255,255,.16);padding:5px 9px;border-radius:8px;}
.row.assistant .msg-file{background:var(--accent-soft);color:var(--ink);}
.typing{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:14px;}
.typing span{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:bounce 1.2s infinite;}
.typing span:nth-child(2){animation-delay:.15s;}
.typing span:nth-child(3){animation-delay:.3s;margin-right:6px;}
.typing em{font-style:normal;}
@keyframes bounce{0%,80%,100%{opacity:.3;transform:translateY(0);}40%{opacity:1;transform:translateY(-4px);}}
@keyframes popIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

.composer-wrap{max-width:720px;width:100%;margin:0 auto;padding:0 24px 14px;}
.notice{background:var(--accent-soft);border:1px solid #f7c4ad;color:#9a3a16;font-size:13px;line-height:1.45;padding:10px 13px;border-radius:11px;margin-bottom:9px;}
.composer{background:#fff;border:1px solid var(--line);border-radius:20px;padding:8px;box-shadow:0 6px 24px rgba(28,24,19,.06);}
.att-row{display:flex;flex-wrap:wrap;gap:7px;padding:6px 6px 8px;}
.att{display:inline-flex;align-items:center;gap:6px;background:var(--cream);border:1px solid var(--line);padding:6px 8px 6px 10px;border-radius:10px;font-size:12.5px;max-width:240px;}
.att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.att-x{border:none;background:none;cursor:pointer;font-size:16px;line-height:1;color:var(--muted);padding:0 2px;}
.att-x:hover{color:var(--accent);}
.input-line{display:flex;align-items:flex-end;gap:6px;}
.attach{flex-shrink:0;width:40px;height:40px;border-radius:12px;border:none;background:transparent;color:var(--muted);cursor:pointer;display:grid;place-items:center;transition:.14s;}
.attach:hover{background:var(--cream);color:var(--accent);}
.ta{flex:1;border:none;outline:none;resize:none;font-family:inherit;font-size:15px;line-height:1.5;padding:9px 4px;background:transparent;color:var(--ink);max-height:200px;}
.ta::placeholder{color:#b3a797;}
.send{flex-shrink:0;width:40px;height:40px;border-radius:12px;border:none;background:var(--accent);color:#fff;cursor:pointer;display:grid;place-items:center;transition:.14s;}
.send:hover{background:#d8430f;}
.send:disabled{background:#e7ddd0;color:#b6ab9b;cursor:not-allowed;}
.foot-note{text-align:center;font-size:11px;color:var(--muted);margin:9px 0 0;}
.agent-suggestions{background:#fff;border:1px solid var(--line);border-radius:12px;margin:8px 8px 0;max-height:200px;overflow-y:auto;box-shadow:0 2px 12px rgba(28,24,19,.1);}
.agent-suggestion-item{display:flex;align-items:center;gap:8px;padding:8px 12px;width:100%;border:none;background:transparent;cursor:pointer;font-size:14px;color:var(--ink);transition:.1s;}
.agent-suggestion-item:hover{background:var(--cream);}
.agent-suggestion-item .emoji{font-size:18px;}
.agent-suggestion-item .name{flex:1;text-align:left;color:var(--accent);font-weight:500;}
.dropzone{position:absolute;inset:0;background:rgba(251,248,243,.92);display:grid;place-items:center;z-index:30;border:3px dashed var(--accent);border-radius:18px;margin:10px;}
.dropcard{display:flex;flex-direction:column;align-items:center;gap:10px;color:var(--accent);font-weight:600;}

@media(max-width:900px){
  .side{position:fixed;left:0;top:0;bottom:0;z-index:40;transform:translateX(-100%);transition:transform .22s;box-shadow:0 0 40px rgba(0,0,0,.3);}
  .side.open{transform:translateX(0);}
  .scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:35;}
  .sources-side{position:fixed;left:0;top:0;bottom:0;z-index:38;width:300px;box-shadow:4px 0 24px rgba(0,0,0,.12);}
  .hamburger{display:block;}
}
`;
