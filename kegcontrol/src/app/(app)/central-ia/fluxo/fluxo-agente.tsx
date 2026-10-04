// Mapa mental VISUAL do agente Chopinho (estilo MindMeister): nó central +
// ramos radiais coloridos, cada um com as "folhas" do comportamento. Estático,
// espelha o que está no prompt do agente (src/server/services/agent.ts). Tudo em
// um <svg> com viewBox pra escalar; os nós são foreignObject (HTML dentro do SVG)
// pra ter quebra de linha e chips. Em tela pequena, rola na horizontal.

type Branch = {
  side: "l" | "r";
  color: string;
  emoji: string;
  title: string;
  leaves: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  cy: number; // centro vertical (pra ligar o conector)
};

const EDGE = 380; // largura dos nós dos ramos
const RIGHT_X = 770;
const LEFT_X = 50;

const BRANCHES: Branch[] = [
  {
    side: "r",
    color: "#f59e0b",
    emoji: "🛒",
    title: "Começo do pedido (site-first)",
    leaves: [
      "Cliente quer pedir → manda o site sschopp.com",
      "Fica de suporte: preço, produto, bairro",
      "Oferece o link 1× — depois não repete",
    ],
    x: RIGHT_X,
    y: 20,
    w: EDGE,
    h: 160,
    cy: 100,
  },
  {
    side: "r",
    color: "#38bdf8",
    emoji: "🔁",
    title: "Retoma o carrinho do site",
    leaves: [
      "Acha o pedido pelo #código ou pelo telefone",
      "Mostra o resumo do que o cliente montou",
      "Pergunta: fechar aqui ou terminar no site?",
      "Manda o link de volta pro carrinho preenchido",
    ],
    x: RIGHT_X,
    y: 330,
    w: EDGE,
    h: 190,
    cy: 425,
  },
  {
    side: "r",
    color: "#2dd4bf",
    emoji: "💰",
    title: "Preços",
    leaves: [
      "Sempre pela ferramenta, por bairro",
      "Tabela completa quando pedem",
      "Total exato — nunca calcula de cabeça",
    ],
    x: RIGHT_X,
    y: 680,
    w: EDGE,
    h: 160,
    cy: 760,
  },
  {
    side: "l",
    color: "#34d399",
    emoji: "✅",
    title: "Fecha o pedido",
    leaves: [
      "Coleta: nome, produto, endereço, escada, casa ou salão, data e horário, chopeira, CPF, pagamento",
      "finalizar_pedido → vai pra Pedidos do Agente",
      "PIX automático, em mensagem separada",
      "Resumo completo colado do site → fecha de uma vez",
    ],
    x: LEFT_X,
    y: 10,
    w: EDGE,
    h: 210,
    cy: 115,
  },
  {
    side: "l",
    color: "#fb7185",
    emoji: "🎄",
    title: "Datas especiais",
    leaves: ["24, 25, 30 e 31 de dezembro", "A equipe assume — o agente não fecha"],
    x: LEFT_X,
    y: 380,
    w: EDGE,
    h: 130,
    cy: 445,
  },
  {
    side: "l",
    color: "#a78bfa",
    emoji: "🔒",
    title: "Regras invioláveis",
    leaves: [
      "Nunca inventa chave PIX",
      "Uma pergunta por vez",
      "Site primeiro; sem barra no texto",
    ],
    x: LEFT_X,
    y: 680,
    w: EDGE,
    h: 160,
    cy: 760,
  },
];

const CENTER = { x: 480, y: 375, w: 240, h: 120, cx: 600, cy: 435 };

// Conector curvo (bezier) do centro até o ramo.
function connector(b: Branch): string {
  const sx = b.side === "r" ? CENTER.x + CENTER.w : CENTER.x;
  const sy = CENTER.cy;
  const ex = b.side === "r" ? b.x : b.x + b.w;
  const ey = b.cy;
  const mx = (sx + ex) / 2;
  return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
}

export function FluxoAgente() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4">
      <svg
        viewBox="0 0 1200 860"
        className="h-auto w-full"
        style={{ minWidth: 920 }}
        role="img"
        aria-label="Mapa mental do agente Chopinho"
      >
        {/* conectores (atrás dos nós) */}
        {BRANCHES.map((b, i) => (
          <path
            key={`c${i}`}
            d={connector(b)}
            fill="none"
            stroke={b.color}
            strokeWidth={3}
            strokeOpacity={0.55}
          />
        ))}

        {/* nó central */}
        <foreignObject x={CENTER.x} y={CENTER.y} width={CENTER.w} height={CENTER.h}>
          <div
            className="flex h-full flex-col items-center justify-center rounded-2xl text-center shadow-lg"
            style={{ background: "#f5b301", color: "#1a1a1a", padding: 12 }}
          >
            <div style={{ fontSize: 30, lineHeight: 1 }}>🍺</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>Chopinho</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Agente SS-Chopp no WhatsApp</div>
          </div>
        </foreignObject>

        {/* ramos */}
        {BRANCHES.map((b, i) => (
          <foreignObject key={`b${i}`} x={b.x} y={b.y} width={b.w} height={b.h}>
            <div
              className="flex h-full flex-col rounded-xl"
              style={{
                border: `2px solid ${b.color}`,
                background: `${b.color}1f`,
                padding: 12,
              }}
            >
              <div className="flex items-center gap-2" style={{ color: b.color, fontWeight: 700 }}>
                <span style={{ fontSize: 18 }}>{b.emoji}</span>
                <span style={{ fontSize: 15 }}>{b.title}</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {b.leaves.map((l) => (
                  <li
                    key={l}
                    className="flex gap-1.5 text-foreground"
                    style={{ fontSize: 12.5, lineHeight: 1.3 }}
                  >
                    <span style={{ color: b.color }}>•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}
