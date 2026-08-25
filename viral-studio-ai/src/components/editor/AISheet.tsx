"use client";
// ✨ IA — a área exclusiva da IA: ações de UM TOQUE, sem digitar nada.
// Cada card dispara um comando pronto para o Editor IA (mesmo caminho validado
// do ai-edit). Enquanto trabalha: mensagens vivas, nunca spinner.
import { useCallback, useEffect, useRef, useState } from "react";
import Ic, { type IconName } from "./Icons";

type AIAction = { icon: IconName; label: string; command: string; working: string[] };
type Cat = { name: string; actions: AIAction[] };

const CATS: Cat[] = [
  {
    name: "Estilo",
    actions: [
      { icon: "rocket", label: "Mais Viral", command: "deixe o vídeo mais viral", working: ["Estudando padrões virais…", "Reforçando os picos…"] },
      { icon: "gauge", label: "Mais Dinâmico", command: "deixe o vídeo mais dinâmico: corte pausas e acelere partes lentas", working: ["Acelerando o ritmo…", "Cortando o que atrasa…"] },
      { icon: "clapper", label: "Cinematográfico", command: "aplique um estilo cinematográfico ao vídeo", working: ["Aplicando look de cinema…", "Calibrando as cores…"] },
      { icon: "briefcase", label: "Comercial", command: "deixe o vídeo com cara de anúncio comercial profissional", working: ["Deixando com cara de anúncio…", "Polindo a mensagem…"] },
      { icon: "flame", label: "Estilo MrBeast", command: "aplique o estilo MrBeast", working: ["Modo MrBeast ativado…", "Turbinando a energia…"] },
      { icon: "dumbbell", label: "Estilo Hormozi", command: "aplique o estilo Alex Hormozi", working: ["Modo Hormozi ativado…", "Direto ao ponto…"] },
    ],
  },
  {
    name: "Cortes",
    actions: [
      { icon: "scissors", label: "Cortar Pausas", command: "corte todas as pausas e silêncios do vídeo", working: ["Caçando silêncios…", "Apertando os cortes…"] },
      { icon: "hook", label: "Melhorar Gancho", command: "melhore o gancho dos primeiros 3 segundos para prender a atenção imediatamente", working: ["Melhorando o gancho…", "Testando aberturas…"] },
      { icon: "zoomIn", label: "Punch Zooms", command: "adicione punch zooms nos momentos mais fortes", working: ["Adicionando zooms…", "Marcando os picos…"] },
      { icon: "target", label: "Melhorar Corte", command: "melhore o corte geral do vídeo: remova o que for fraco e mantenha só o essencial", working: ["Repensando o corte…", "Escolhendo os melhores takes…"] },
    ],
  },
  {
    name: "Elementos",
    actions: [
      { icon: "film", label: "B-Rolls", command: "adicione b-rolls nos momentos que pedem ilustração visual", working: ["Procurando B-rolls…", "Encaixando as cenas…"] },
      { icon: "music", label: "Nova Música", command: "adicione ou troque a música de fundo por uma que combine com o vídeo", working: ["Escolhendo a trilha…", "Sincronizando a música…"] },
      { icon: "bolt", label: "Sound FX", command: "adicione sound effects nos momentos de impacto", working: ["Adicionando efeitos sonoros…", "Pontuando os impactos…"] },
      { icon: "mic", label: "Narração", command: "adicione uma narração de IA onde fizer sentido para reforçar a mensagem", working: ["Escrevendo a narração…", "Gravando a voz…"] },
    ],
  },
  {
    name: "Legendas",
    actions: [
      { icon: "captions", label: "Refazer Legendas", command: "refaça o texto das legendas: mais curto, direto e chamativo", working: ["Reescrevendo legendas…", "Deixando mais punchy…"] },
    ],
  },
];

const GENERIC_WORKING = [
  "A IA está editando…",
  "Analisando a timeline…",
  "Aplicando as mudanças…",
  "Quase lá…",
];

type Phase =
  | { s: "idle" }
  | { s: "busy"; action: AIAction }
  | { s: "confirm"; action: AIAction; msg: string }
  | { s: "done"; explanation: string; applied: number; label: string }
  | { s: "error"; msg: string };

export default function AISheet({
  projectId,
  autorun,
  onState,
  onHighlight,
  onUndo,
  onClose,
}: {
  projectId: string;
  /** rótulo de uma ação p/ disparar imediatamente (vindo da Revisão Inteligente) */
  autorun?: string | null;
  onState: (state: unknown) => void;
  onHighlight: (ids: string[]) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ s: "idle" });
  const [workMsg, setWorkMsg] = useState("");
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoranRef = useRef(false);

  // mensagens vivas em rotação enquanto a IA trabalha
  useEffect(() => {
    if (phase.s !== "busy") {
      if (msgTimer.current) clearInterval(msgTimer.current);
      return;
    }
    const pool = [...phase.action.working, ...GENERIC_WORKING];
    let i = 0;
    setWorkMsg(pool[0]);
    msgTimer.current = setInterval(() => {
      i = (i + 1) % pool.length;
      setWorkMsg(pool[i]);
    }, 2200);
    return () => {
      if (msgTimer.current) clearInterval(msgTimer.current);
    };
  }, [phase]);

  const run = useCallback(
    async (action: AIAction, force = false) => {
      setPhase({ s: "busy", action });
      try {
        const res = await fetch(`/api/projects/${projectId}/ai-edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: action.command, force }),
        });
        const json = await res.json();
        if (res.status === 202 && json.needsConfirmation) {
          setPhase({ s: "confirm", action, msg: json.error });
        } else if (!res.ok) {
          setPhase({ s: "error", msg: json.error ?? "A IA não conseguiu concluir. Tente de novo." });
        } else {
          onState(json);
          if (json.touched?.length) onHighlight(json.touched);
          setPhase({ s: "done", explanation: json.explanation ?? "", applied: json.applied ?? 0, label: action.label });
        }
      } catch {
        setPhase({ s: "error", msg: "Sem conexão com o servidor. Verifique a rede e tente de novo." });
      }
    },
    [projectId, onState, onHighlight]
  );

  // Revisão Inteligente pediu uma correção específica: dispara direto
  useEffect(() => {
    if (!autorun || autoranRef.current) return;
    autoranRef.current = true;
    const act = CATS.flatMap((c) => c.actions).find((a) => a.label === autorun);
    if (act) void run(act);
  }, [autorun, run]);

  return (
    <div className="ed-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && phase.s !== "busy") onClose(); }}>
      <div className="ed-modal">
        <div className="grab" />
        {phase.s === "idle" && (
          <>
            <h3 className="ed-h3ic"><Ic name="sparkles" size={18} className="ed-grad-ic" /> Editar com IA</h3>
            <p className="sub">Toque em uma ação. A IA edita, você confere — e desfaz com um toque se não gostar.</p>
            {CATS.map((cat) => (
              <div key={cat.name}>
                <div className="ed-ai-cat">{cat.name}</div>
                <div className="ed-ai-grid">
                  {cat.actions.map((a) => (
                    <button key={a.label} className="ed-ai-act" onClick={() => void run(a)}>
                      <span className="ic"><Ic name={a.icon} size={23} /></span>
                      <span className="lb">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {phase.s === "busy" && (
          <div className="ed-ai-progress">
            <span className="spark"><Ic name="sparkles" size={34} /></span>
            <div className="msg" key={workMsg}>{workMsg}</div>
            <div className="bar"><i /></div>
          </div>
        )}

        {phase.s === "confirm" && (
          <div className="ed-ai-result">
            <div className="ok"><Ic name="alertTriangle" size={16} style={{ color: "var(--amber)" }} /> Mudança grande</div>
            <p className="expl">{phase.msg}</p>
            <div className="row">
              <button className="ed-cta" style={{ marginTop: 0 }} onClick={() => void run(phase.action, true)}>
                Aplicar mesmo assim
              </button>
              <button className="ed-cta ghost" style={{ marginTop: 0 }} onClick={() => setPhase({ s: "idle" })}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {phase.s === "done" && (
          <div className="ed-ai-result">
            <div className="ok">
              {phase.applied > 0 ? (
                <><Ic name="checkCircle" size={16} style={{ color: "var(--green)" }} /> {phase.label} — {phase.applied} mudança(s)</>
              ) : (
                <><Ic name="checkCircle" size={16} style={{ color: "var(--muted)" }} /> Nada para mudar</>
              )}
            </div>
            <p className="expl">{phase.explanation}</p>
            <div className="row">
              {phase.applied > 0 && (
                <button
                  className="ed-cta ghost ed-cta-ic"
                  style={{ marginTop: 0 }}
                  onClick={() => { onUndo(); setPhase({ s: "idle" }); }}
                >
                  <Ic name="undo" size={15} /> Desfazer
                </button>
              )}
              <button className="ed-cta" style={{ marginTop: 0 }} onClick={onClose}>
                Ver resultado
              </button>
            </div>
          </div>
        )}

        {phase.s === "error" && (
          <div className="ed-ai-result">
            <div className="ok"><Ic name="alertCircle" size={16} style={{ color: "var(--red)" }} /> Não deu certo</div>
            <p className="expl">{phase.msg}</p>
            <div className="row">
              <button className="ed-cta ghost ed-cta-ic" style={{ marginTop: 0 }} onClick={() => setPhase({ s: "idle" })}>
                <Ic name="chevronLeft" size={15} /> Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
