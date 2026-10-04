// Fluxograma DETALHADO do agente: cada decisão (os "ifs") com os ramos e a
// RESPOSTA real que o agente dá em cada caso. Espelha a lógica do prompt
// (src/server/services/agent.ts). Estático. Lido de cima pra baixo, como um
// fluxograma: cada bloco é uma pergunta que o agente se faz; os ramos são as
// saídas, com um exemplo de fala entre aspas quando faz sentido.

type Tone = "go" | "stop" | "special" | "ask";

type Branch = {
  tag: string; // o "caso" (ex.: SIM, NÃO, "carrinho completo")
  tone: Tone;
  text: string; // o que o agente faz
  reply?: string; // exemplo da fala do agente (bolha de WhatsApp)
};

type Decision = {
  n: number;
  color: string;
  cond: string; // a pergunta (o "if")
  branches: Branch[];
};

const TONE_STYLE: Record<Tone, { bg: string; fg: string; label: string }> = {
  go: { bg: "#16a34a22", fg: "#22c55e", label: "➜" },
  stop: { bg: "#dc262622", fg: "#f87171", label: "✋" },
  special: { bg: "#d9770622", fg: "#fbbf24", label: "★" },
  ask: { bg: "#0284c722", fg: "#38bdf8", label: "?" },
};

const DECISIONS: Decision[] = [
  {
    n: 1,
    color: "#a78bfa",
    cond: "O agente está LIGADO e este cliente está liberado?",
    branches: [
      { tag: "NÃO", tone: "stop", text: "Fica em silêncio — não responde (o dono desligou o agente ou não liberou este contato)." },
      { tag: "SIM", tone: "go", text: "Segue para a próxima decisão ↓" },
    ],
  },
  {
    n: 2,
    color: "#f59e0b",
    cond: "É a PRIMEIRA mensagem da conversa (contato novo, sem nome)?",
    branches: [
      {
        tag: "Veio o pedido COMPLETO do site",
        tone: "go",
        text: "Lê tudo de uma vez e já fecha — não pede o nome.",
        reply: "Pronto! ✅ Seu pedido está registrado. A equipe já vai entrar em contato 🍺",
      },
      {
        tag: "Tem carrinho do site (#código ou telefone)",
        tone: "go",
        text: "Retoma de onde parou — não pede o nome (decisão 4).",
        reply: "Oi, Joana! 😊 Vi que você começou um pedido de 2 Belco 50L no site…",
      },
      {
        tag: "Nenhum dos dois",
        tone: "ask",
        text: "Abertura fixa, pedindo o nome.",
        reply: "Oi! Eu sou o Chopinho, da SS-Chopp 🍺 Com quem eu falo?",
      },
    ],
  },
  {
    n: 3,
    color: "#f59e0b",
    cond: 'O cliente mostra que QUER fazer um pedido? ("quero chopp", "é pra uma festa")',
    branches: [
      {
        tag: "SIM",
        tone: "go",
        text: "Site-first: manda o link e fica de suporte (oferece 1× só).",
        reply: "Boa! 🍺 Pra ficar rápido, monta aqui ó: sschopp.com — qualquer dúvida me chama!",
      },
      { tag: "Só dúvida / saudação", tone: "ask", text: "Responde normal, sem forçar o link." },
    ],
  },
  {
    n: 4,
    color: "#38bdf8",
    cond: "Ele tem um carrinho do site pra CONTINUAR? (achado por #código ou telefone)",
    branches: [
      {
        tag: 'Completo + "fecha aqui"',
        tone: "go",
        text: "Pede só o que o site não coleta: CPF e forma de pagamento → finaliza (decisão 7).",
        reply: "Perfeito! Pra registrar, me passa seu CPF por favor 😉",
      },
      {
        tag: 'Incompleto + "fecha aqui"',
        tone: "ask",
        text: "Pergunta só o que falta, uma coisa por vez, até ter tudo → finaliza.",
      },
      {
        tag: '"Prefiro no site"',
        tone: "go",
        text: "Manda o link que volta pro carrinho JÁ preenchido.",
        reply: "Fechado! Dá pra terminar por aqui ó: sschopp.com/carrinho?p=A7K2",
      },
    ],
  },
  {
    n: 5,
    color: "#2dd4bf",
    cond: "Perguntou PREÇO?",
    branches: [
      {
        tag: "Já sei o bairro",
        tone: "go",
        text: "Consulta a ferramenta de preço por bairro e responde na hora.",
        reply: "Belco 50L pra Xerém sai R$600 a unidade, com frete grátis 🍺",
      },
      { tag: "Ainda não sei o bairro", tone: "ask", text: "Pede só o bairro, depois responde o preço.", reply: "Me diz seu bairro que já te passo o valor certinho 😉" },
      { tag: "Bairro fora da área", tone: "stop", text: "Aí sim encaminha pro comercial (só neste caso)." },
    ],
  },
  {
    n: 6,
    color: "#fb7185",
    cond: "A data é 24, 25, 30 ou 31 de dezembro? (Natal / Ano Novo)",
    branches: [
      {
        tag: "SIM",
        tone: "stop",
        text: "PARA tudo — a equipe assume. NÃO cota preço e NÃO finaliza.",
        reply: "Pra Natal e Ano Novo nossa equipe cuida pessoalmente 🎄 Já vou passar seu contato!",
      },
      { tag: "NÃO", tone: "go", text: "Segue o fluxo normal." },
    ],
  },
  {
    n: 7,
    color: "#34d399",
    cond: "Já tem TODOS os dados obrigatórios e o cliente confirmou?",
    branches: [
      { tag: "Falta data ou horário", tone: "ask", text: "Guarda o que já tem e pergunta o que falta — não fecha sem isso." },
      {
        tag: "Tem tudo",
        tone: "go",
        text: "Chama finalizar_pedido → cai em “Pedidos do Agente” → PIX vai automático, em mensagem separada.",
        reply: "Pronto! ✅ Seu pedido está registrado. A equipe já vai entrar em contato. 🍺🚚",
      },
    ],
  },
  {
    n: 8,
    color: "#a78bfa",
    cond: "O pedido JÁ foi finalizado e o cliente manda mais mensagem?",
    branches: [
      { tag: "SIM", tone: "go", text: "Responde curtinho e NÃO reinicia o fluxo (só recomeça se for um pedido novo).", reply: "A equipe já vai te chamar 😉" },
    ],
  },
];

export function FluxoDetalhado() {
  return (
    <div className="flex flex-col gap-0">
      {DECISIONS.map((d, i) => (
        <div key={d.n} className="relative">
          {/* bloco da decisão */}
          <div
            className="rounded-xl border bg-card p-4"
            style={{ borderLeftWidth: 5, borderLeftColor: d.color }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold"
                style={{ background: d.color, color: "#1a1a1a" }}
              >
                {d.n}
              </span>
              <span className="text-sm font-semibold text-foreground">SE: {d.cond}</span>
            </div>

            <div className="mt-3 flex flex-col gap-2 pl-10">
              {d.branches.map((b) => {
                const t = TONE_STYLE[b.tone];
                return (
                  <div key={b.tag} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ background: t.bg, color: t.fg }}
                      >
                        {t.label} {b.tag}
                      </span>
                      <span className="text-sm text-muted-foreground">{b.text}</span>
                    </div>
                    {b.reply && (
                      <div className="ml-1 max-w-xl rounded-lg rounded-tl-sm border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm text-foreground">
                        💬 <span className="italic">“{b.reply}”</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* conector vertical entre blocos */}
          {i < DECISIONS.length - 1 && (
            <div className="flex justify-center py-1">
              <span className="text-muted-foreground">↓</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
