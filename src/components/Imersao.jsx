import React, { useState } from 'react';
import '../Imersao.css';

export default function Imersao() {
  const [activePage, setActivePage] = useState('dashboard');
  
  const go = (page) => setActivePage(page);

  return (
    <>
      
<div className="app">
  {/*  SIDEBAR  */}
  <aside className="sidebar">
    <div className="brand">
      <div className="brand-logo">
        <div className="cd">CD GRUPO</div>
        <div className="cs">CUSTOMER SUCCESS</div>
      </div>
    </div>
    <nav className="nav">
      <div className="nav-section">Operação</div>
      <div className="nav-item active" data-page="dashboard">
        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        <span>Dashboard</span>
      </div>
      <div className="nav-item" data-page="mentorados">
        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Mentorados</span>
      </div>
      <div className="nav-item" data-page="trilha">
        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>
        <span>Trilha dos 7 Pilares</span>
      </div>
      <div className="nav-item" data-page="analise">
        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        <span>Análise de Call</span>
      </div>
      <div className="nav-item" data-page="commitments">
        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <span>Commitments</span>
        <span className="badge">11</span>
      </div>
      <div className="nav-item" data-page="alertas">
        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Alertas</span>
        <span className="badge">4</span>
      </div>
    </nav>
    <div className="sidebar-foot">
      <div className="avatar">RC</div>
      <div className="user-info"><div className="name">Rafael Costa</div><div className="role">Head de Mentoria</div></div>
    </div>
  </aside>

  {/*  MAIN  */}
  <div className="main">
    <header className="topbar">
      <div className="crumb"><span>CD Grupo · Imersão</span><span>›</span><span className="now" id="crumbNow">Dashboard</span></div>
      <div className="topbar-actions">
        <input className="search" placeholder="Buscar mentorado, pilar, commitment…" />
        <button className="btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Novo mentorado</button>
      </div>
    </header>

    {/*  ============ DASHBOARD ============  */}
    <section className="page active" id="page-dashboard">
      <div className="page-head">
        <h1 className="serif">Bom dia, Rafael. <em>Três coisas</em> pra olhar antes das calls de hoje.</h1>
        <div className="sub">Quinta, 7 de junho · 4 mentorados ativos da Imersão · próxima call em 1h12</div>
      </div>

      <div className="grid g-4" style={{"marginBottom":"24px"}}>
        <div className="kpi"><div className="lbl">Mentorados ativos</div><div className="val">4</div><div className="delta">+1 este mês</div></div>
        <div className="kpi"><div className="lbl">Faturamento sob mentoria</div><div className="val">R$ 315k</div><div className="delta">+18% MoM</div></div>
        <div className="kpi"><div className="lbl">Pilares dominados</div><div className="val">17<span style={{"fontSize":"1rem","color":"var(--muted)"}}>/28</span></div><div className="delta">+3 no mês</div></div>
        <div className="kpi"><div className="lbl">Commitments abertos</div><div className="val">11</div><div className="delta down">3 atrasados</div></div>
      </div>

      {/*  TRILHA AGREGADA  */}
      <div className="trilha" style={{"marginBottom":"24px"}}>
        <div className="trilha-h">
          <h3>Avanço agregado na metodologia dos 7 Pilares</h3>
          <div className="trilha-legend">
            <span><span className="dot" style={{"background":"var(--green)"}}></span> Dominado pela carteira</span>
            <span><span className="dot" style={{"background":"var(--gold-500)"}}></span> Em progresso</span>
            <span><span className="dot" style={{"background":"#d8d3c5"}}></span> Pouco trabalhado</span>
          </div>
        </div>
        <div className="pillars">
          <div className="pillar mastered"><div className="node">1</div><div className="lbl">Estratagemas que decidem o jogo</div><div className="pct">4/4 dominam</div></div>
          <div className="pillar mastered"><div className="node">2</div><div className="lbl">Comunicação e Negociação</div><div className="pct">3/4 dominam</div></div>
          <div className="pillar active"><div className="node">3</div><div className="lbl">Pensar como roteirista</div><div className="pct">2 trabalhando</div></div>
          <div className="pillar partial"><div className="node">4</div><div className="lbl">Edição magnética</div><div className="pct">1 trabalhando</div></div>
          <div className="pillar partial"><div className="node">5</div><div className="lbl">Mosaico da utilidade</div><div className="pct">1 trabalhando</div></div>
          <div className="pillar active"><div className="node">6</div><div className="lbl">Calendário estratégico</div><div className="pct">2 trabalhando</div></div>
          <div className="pillar partial"><div className="node">7</div><div className="lbl">Funil validado pro negócio</div><div className="pct">1/4 dominam</div></div>
        </div>
      </div>

      <div className="grid g-23" style={{"marginBottom":"24px"}}>
        <div className="card">
          <div className="card-h"><h3>⚠️ Alertas que pedem ação</h3><span className="lnk" data-jump="alertas">Ver todos →</span></div>
          <div className="list-item">
            <div className="ico red">!</div>
            <div className="body">
              <div className="ti">Doce Casa Digital: faturamento em queda 3º mês seguido</div>
              <div className="de">R$ 240k → R$ 195k → R$ 180k. Renata travada no pilar "Pensar como roteirista" há 4 calls.</div>
              <div className="meta"><span>Alta severidade</span><span>·</span><span>hoje</span></div>
            </div>
          </div>
          <div className="list-item">
            <div className="ico amber">!</div>
            <div className="body">
              <div className="ti">Marina Cordeiro não posta há 10 dias</div>
              <div className="de">Possível bloqueio criativo. Última call mencionou "não tô achando o que falar".</div>
              <div className="meta"><span>Média severidade</span><span>·</span><span>ontem</span></div>
            </div>
          </div>
          <div className="list-item">
            <div className="ico amber">3</div>
            <div className="body">
              <div className="ti">3 commitments atrasados na carteira</div>
              <div className="de">Doce Casa (gravação de 3 vídeos), Marina (reescrever oferta), Studio Galo (teste de funil).</div>
              <div className="meta"><span>Média</span><span>·</span><span>vencendo</span></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>📅 Calls de hoje</h3></div>
          <div className="list-item">
            <div className="ico gold">10</div>
            <div className="body">
              <div className="ti">Studio Galo Roxo · Mentoria semanal</div>
              <div className="de">10h · Henrique e Letícia (sócios)</div>
              <div className="meta"><span className="health green">verde</span><span>Pilar atual: Comunicação</span></div>
            </div>
          </div>
          <div className="list-item">
            <div className="ico gold">14</div>
            <div className="body">
              <div className="ti">Henrique Faria · Pré-lançamento</div>
              <div className="de">14h · revisão do funil</div>
              <div className="meta"><span className="health green">verde</span><span>Pilar: Edição magnética</span></div>
            </div>
          </div>
          <div className="list-item">
            <div className="ico gold">16</div>
            <div className="body">
              <div className="ti">Doce Casa Digital · Call de resgate</div>
              <div className="de">16h30 · Renata Salles (fundadora)</div>
              <div className="meta"><span className="health red">vermelho</span><span>Pilar travada: Roteirista</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="card-h"><h3>Mentorados por saúde</h3><span className="lnk" data-jump="mentorados">Ver carteira →</span></div>
          <table className="tbl">
            <thead><tr><th>Mentorado</th><th>Pilar atual</th><th>Faturamento</th></tr></thead>
            <tbody>
              <tr data-jump="perfil"><td><div className="nome">Doce Casa Digital</div><div className="sub">E-commerce decoração · 11 meses</div></td><td><span className="pill amber">Pensar como roteirista</span></td><td><strong>R$ 180k</strong> ↓</td></tr>
              <tr><td><div className="nome">Marina Cordeiro</div><div className="sub">Coach de carreira · 5 meses</div></td><td><span className="pill gold">Calendário estratégico</span></td><td><strong>R$ 80k</strong> ↑</td></tr>
              <tr><td><div className="nome">Studio Galo Roxo</div><div className="sub">Agência social media · 7 meses</div></td><td><span className="pill gold">Comunicação</span></td><td><strong>R$ 35k</strong> ↑</td></tr>
              <tr><td><div className="nome">Henrique Faria</div><div className="sub">Criador financeiro · 3 meses</div></td><td><span className="pill gold">Edição magnética</span></td><td><strong>R$ 20k</strong> ↑↑</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-h"><h3>Insight do <em className="serif">Mentor de CS</em></h3><span className="pill gold">IA</span></div>
          <p style={{"fontFamily":"'Instrument Serif',serif","fontSize":"1.35rem","lineHeight":"1.35","color":"var(--navy-800)","margin":"6px 0 14px"}}>
            "Três dos quatro mentorados estão travando no <em>mesmo pilar</em> — "Pensar como roteirista". Vale considerar uma sessão coletiva ao invés de tratar caso a caso."
          </p>
          <div style={{"display":"flex","justifyContent":"space-between","alignItems":"center","borderTop":"1px solid var(--border-soft)","paddingTop":"14px"}}>
            <div style={{"fontSize":".78rem","color":"var(--muted)"}}>Padrão identificado em 9 calls dos últimos 30 dias</div>
            <button className="btn btn-ghost" data-jump="trilha">Ver trilha completa</button>
          </div>
        </div>
      </div>
    </section>

    {/*  ============ MENTORADOS ============  */}
    <section className="page" id="page-mentorados">
      <div className="page-head">
        <h1 className="serif">Carteira de <em>mentorados</em> da Imersão</h1>
        <div className="sub">4 ativos · clique em qualquer linha pra abrir o perfil</div>
      </div>
      <div className="card">
        <div style={{"display":"flex","gap":"8px","marginBottom":"16px","alignItems":"center","flexWrap":"wrap"}}>
          <button className="btn btn-ghost" style={{"padding":"6px 12px","fontSize":".78rem"}}>Todos (4)</button>
          <button className="btn btn-ghost" style={{"padding":"6px 12px","fontSize":".78rem"}}><span className="health green" style={{"padding":"2px 8px"}}>Verde 3</span></button>
          <button className="btn btn-ghost" style={{"padding":"6px 12px","fontSize":".78rem"}}><span className="health amber" style={{"padding":"2px 8px"}}>Amarelo 0</span></button>
          <button className="btn btn-ghost" style={{"padding":"6px 12px","fontSize":".78rem"}}><span className="health red" style={{"padding":"2px 8px"}}>Vermelho 1</span></button>
          <div style={{"marginLeft":"auto","color":"var(--muted)","fontSize":".8rem"}}>Ordenar por: <strong style={{"color":"var(--navy-800)"}}>Risco ↓</strong></div>
        </div>
        <table className="tbl">
          <thead><tr><th>Mentorado</th><th>Nicho</th><th>Health</th><th>Faturamento</th><th>Pilar atual</th><th>Pilares dominados</th><th>Próxima call</th></tr></thead>
          <tbody>
            <tr data-jump="perfil">
              <td><div className="nome">Doce Casa Digital</div><div className="sub">Renata Salles · 11 meses</div></td>
              <td>E-commerce decoração</td>
              <td><span className="health red">Vermelho</span></td>
              <td><strong>R$ 180k</strong> <span style={{"color":"var(--red)","fontSize":".75rem"}}>↓25%</span></td>
              <td><span className="pill amber">3 · Roteirista</span></td>
              <td><strong>2/7</strong></td>
              <td><strong>Hoje 16h30</strong></td>
            </tr>
            <tr>
              <td><div className="nome">Marina Cordeiro</div><div className="sub">Coach · 5 meses</div></td>
              <td>Coach de carreira</td>
              <td><span className="health green">Verde</span></td>
              <td><strong>R$ 80k</strong> <span style={{"color":"var(--green)","fontSize":".75rem"}}>↑12%</span></td>
              <td><span className="pill gold">6 · Calendário</span></td>
              <td><strong>5/7</strong></td>
              <td>Sex, 9 jun · 11h</td>
            </tr>
            <tr>
              <td><div className="nome">Studio Galo Roxo</div><div className="sub">Henrique & Letícia · 7 meses</div></td>
              <td>Agência social media</td>
              <td><span className="health green">Verde</span></td>
              <td><strong>R$ 35k</strong> <span style={{"color":"var(--green)","fontSize":".75rem"}}>↑8%</span></td>
              <td><span className="pill gold">2 · Comunicação</span></td>
              <td><strong>4/7</strong></td>
              <td>Hoje 10h</td>
            </tr>
            <tr>
              <td><div className="nome">Henrique Faria</div><div className="sub">Criador · 3 meses</div></td>
              <td>Finanças pessoais</td>
              <td><span className="health green">Verde</span></td>
              <td><strong>R$ 20k</strong> <span style={{"color":"var(--green)","fontSize":".75rem"}}>↑45%</span></td>
              <td><span className="pill gold">4 · Edição</span></td>
              <td><strong>3/7</strong></td>
              <td>Hoje 14h</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    {/*  ============ TRILHA DOS 7 PILARES ============  */}
    <section className="page" id="page-trilha">
      <div className="page-head">
        <h1 className="serif">Trilha dos <em>7 Pilares</em></h1>
        <div className="sub">Onde cada mentorado está na metodologia da Imersão</div>
      </div>

      <div className="trilha" style={{"marginBottom":"24px"}}>
        <div className="trilha-h">
          <h3>Visão da carteira inteira</h3>
        </div>
        <div className="pillars">
          <div className="pillar mastered"><div className="node">1</div><div className="lbl">Estratagemas que decidem o jogo</div><div className="pct">4/4 · 100%</div></div>
          <div className="pillar mastered"><div className="node">2</div><div className="lbl">Comunicação e Negociação</div><div className="pct">3/4 · 75%</div></div>
          <div className="pillar active"><div className="node">3</div><div className="lbl">Pensar como roteirista</div><div className="pct">1/4 · 25%</div></div>
          <div className="pillar partial"><div className="node">4</div><div className="lbl">Edição magnética</div><div className="pct">0/4 · 0%</div></div>
          <div className="pillar partial"><div className="node">5</div><div className="lbl">Mosaico da utilidade</div><div className="pct">1/4 · 25%</div></div>
          <div className="pillar active"><div className="node">6</div><div className="lbl">Calendário estratégico</div><div className="pct">2/4 · 50%</div></div>
          <div className="pillar partial"><div className="node">7</div><div className="lbl">Funil validado pro negócio</div><div className="pct">1/4 · 25%</div></div>
        </div>
        <div style={{"marginTop":"18px","paddingTop":"18px","borderTop":"1px solid var(--border-soft)","fontSize":".85rem","color":"var(--ink-soft)","fontStyle":"italic"}}>
          💡 <strong style={{"color":"var(--navy-800)","fontStyle":"normal"}}>Leitura do agente:</strong> a carteira tem força nos pilares iniciais (1 e 2) mas se trava em "Pensar como roteirista" — sintoma clássico de quem aprende estratégia mas não consegue traduzir em conteúdo. Pode ser oportunidade pra um módulo intensivo extra.
        </div>
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="card-h"><h3>Doce Casa Digital · Renata Salles</h3><span className="health red">Vermelho</span></div>
          <div className="pillars" style={{"marginTop":"8px"}}>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Estratagemas</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Comunicação</div></div>
            <div className="pillar active"><div className="node">!</div><div className="lbl">Roteirista</div></div>
            <div className="pillar partial"><div className="node">4</div><div className="lbl">Edição</div></div>
            <div className="pillar partial"><div className="node">5</div><div className="lbl">Mosaico</div></div>
            <div className="pillar partial"><div className="node">6</div><div className="lbl">Calendário</div></div>
            <div className="pillar partial"><div className="node">7</div><div className="lbl">Funil</div></div>
          </div>
          <div style={{"marginTop":"14px","fontSize":".84rem","color":"var(--ink-soft)"}}><strong style={{"color":"var(--red)"}}>Travada há 4 calls</strong> no pilar 3. Não consegue traduzir estratégia em conteúdo orgânico.</div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Marina Cordeiro</h3><span className="health green">Verde</span></div>
          <div className="pillars" style={{"marginTop":"8px"}}>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Estratagemas</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Comunicação</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Roteirista</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Edição</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Mosaico</div></div>
            <div className="pillar active"><div className="node">!</div><div className="lbl">Calendário</div></div>
            <div className="pillar partial"><div className="node">7</div><div className="lbl">Funil</div></div>
          </div>
          <div style={{"marginTop":"14px","fontSize":".84rem","color":"var(--ink-soft)"}}>Aluna modelo. Está montando o calendário estratégico do segundo semestre.</div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Studio Galo Roxo</h3><span className="health green">Verde</span></div>
          <div className="pillars" style={{"marginTop":"8px"}}>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Estratagemas</div></div>
            <div className="pillar active"><div className="node">!</div><div className="lbl">Comunicação</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Roteirista</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Edição</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Mosaico</div></div>
            <div className="pillar partial"><div className="node">6</div><div className="lbl">Calendário</div></div>
            <div className="pillar partial"><div className="node">7</div><div className="lbl">Funil</div></div>
          </div>
          <div style={{"marginTop":"14px","fontSize":".84rem","color":"var(--ink-soft)"}}>Pulou pilar 2 — voltou agora pra fechar antes de ir pro 6. Bom autoconhecimento.</div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Henrique Faria</h3><span className="health green">Verde</span></div>
          <div className="pillars" style={{"marginTop":"8px"}}>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Estratagemas</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Comunicação</div></div>
            <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Roteirista</div></div>
            <div className="pillar active"><div className="node">!</div><div className="lbl">Edição</div></div>
            <div className="pillar partial"><div className="node">5</div><div className="lbl">Mosaico</div></div>
            <div className="pillar partial"><div className="node">6</div><div className="lbl">Calendário</div></div>
            <div className="pillar partial"><div className="node">7</div><div className="lbl">Funil</div></div>
          </div>
          <div style={{"marginTop":"14px","fontSize":".84rem","color":"var(--ink-soft)"}}>Mais rápido da carteira. Já tá testando edição em vídeo curto antes do lançamento.</div>
        </div>
      </div>
    </section>

    {/*  ============ PERFIL ============  */}
    <section className="page" id="page-perfil">
      <div className="page-head" style={{"marginBottom":"18px"}}>
        <div style={{"fontSize":".78rem","color":"var(--muted)","marginBottom":"6px"}}><span style={{"cursor":"pointer"}} data-jump="mentorados">← voltar pra carteira</span></div>
      </div>

      <div className="profile-head">
        <div className="profile-avatar">D</div>
        <div className="profile-info">
          <div style={{"display":"flex","alignItems":"center","gap":"10px","marginBottom":"4px"}}>
            <span className="health red" style={{"background":"rgba(181,60,60,.2)","color":"#ff9d9d"}}>Vermelho</span>
            <span className="pill" style={{"background":"rgba(255,255,255,.1)","color":"rgba(255,255,255,.8)","borderColor":"rgba(255,255,255,.15)"}}>E-commerce de decoração</span>
          </div>
          <h2>Doce Casa Digital</h2>
          <div className="profile-meta">
            <span>Fundadora <strong>Renata Salles</strong></span>
            <span>Faturamento <strong>R$ 180k/mês</strong> <span style={{"color":"#ff9d9d"}}>↓ 25% em 90d</span></span>
            <span>Imersão <strong>11 meses</strong></span>
            <span>Pilar atual <strong>3 · Pensar como roteirista</strong></span>
          </div>
        </div>
        <div className="profile-actions">
          <button className="btn btn-gold">Abrir call de hoje</button>
          <button className="btn" style={{"background":"rgba(255,255,255,.1)"}}>Plano de resgate</button>
        </div>
      </div>

      {/*  TRILHA INDIVIDUAL  */}
      <div className="trilha" style={{"marginBottom":"22px"}}>
        <div className="trilha-h">
          <h3>Trilha da Renata</h3>
          <span className="pill amber">Travada no pilar 3</span>
        </div>
        <div className="pillars">
          <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Estratagemas que decidem o jogo</div><div className="pct">dominado · mês 2</div></div>
          <div className="pillar mastered"><div className="node">✓</div><div className="lbl">Comunicação e Negociação</div><div className="pct">dominado · mês 4</div></div>
          <div className="pillar active"><div className="node">!</div><div className="lbl">Pensar como roteirista</div><div className="pct">4 calls travada</div></div>
          <div className="pillar partial"><div className="node">4</div><div className="lbl">Edição magnética</div><div className="pct">não iniciado</div></div>
          <div className="pillar partial"><div className="node">5</div><div className="lbl">Mosaico da utilidade</div><div className="pct">não iniciado</div></div>
          <div className="pillar partial"><div className="node">6</div><div className="lbl">Calendário estratégico</div><div className="pct">não iniciado</div></div>
          <div className="pillar partial"><div className="node">7</div><div className="lbl">Funil validado pro negócio</div><div className="pct">não iniciado</div></div>
        </div>
      </div>

      <div className="grid g-23" style={{"marginBottom":"22px"}}>
        <div>
          <div className="card" style={{"marginBottom":"18px"}}>
            <div className="card-h"><h3>Faturamento mensal (últimos 6 meses)</h3><span className="pill red">↓ caindo</span></div>
            <div className="spark">
              <div className="b g" style={{"height":"90%"}}></div>
              <div className="b g" style={{"height":"95%"}}></div>
              <div className="b g" style={{"height":"88%"}}></div>
              <div className="b a" style={{"height":"80%"}}></div>
              <div className="b a" style={{"height":"65%"}}></div>
              <div className="b r" style={{"height":"60%"}}></div>
            </div>
            <div style={{"display":"flex","justifyContent":"space-between","fontSize":".72rem","color":"var(--muted)","marginTop":"4px"}}><span>Jan · 270k</span><span>Fev · 290k</span><span>Mar · 260k</span><span>Abr · 240k</span><span>Mai · 195k</span><span>Jun · 180k</span></div>
          </div>

          <div className="card" style={{"marginBottom":"18px"}}>
            <div className="card-h"><h3>Métricas do negócio</h3></div>
            <div style={{"display":"flex","flexDirection":"column","gap":"14px","marginTop":"6px"}}>
              <div className="exec-row"><div className="lbl">Frequência de conteúdo</div><div className="exec-bar"><div className="fill" style={{"width":"18%","background":"var(--red)"}}></div></div><div className="pct">2/sem</div></div>
              <div className="exec-row"><div className="lbl">Taxa de conversão site</div><div className="exec-bar"><div className="fill" style={{"width":"35%","background":"var(--amber)"}}></div></div><div className="pct">1.2%</div></div>
              <div className="exec-row"><div className="lbl">Ticket médio</div><div className="exec-bar"><div className="fill" style={{"width":"70%"}}></div></div><div className="pct">R$ 280</div></div>
              <div className="exec-row"><div className="lbl">Cumprimento de tarefas</div><div className="exec-bar"><div className="fill" style={{"width":"42%","background":"var(--amber)"}}></div></div><div className="pct">42%</div></div>
            </div>
            <div style={{"marginTop":"14px","paddingTop":"14px","borderTop":"1px solid var(--border-soft)","fontSize":".84rem","color":"var(--ink-soft)","fontStyle":"italic"}}>
              Padrão: frequência de conteúdo despencou de 5x/semana pra 2. Não é problema de produto — é gargalo no pilar 3.
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Último relatório do <em className="serif">Mentor de CS</em></h3><span className="pill gold">IA · há 2d</span></div>
            <p className="serif" style={{"fontSize":"1.15rem","lineHeight":"1.45","color":"var(--navy-800)","margin":"6px 0 12px"}}>
              "Renata <em>sabe</em> o que falar (domina os pilares 1 e 2), mas <em>não sabe como contar</em>. A queda de faturamento é sintoma — o problema-raiz é criativo, não estratégico. Não vale empurrar pilar 4 antes de destravar isso."
            </p>
            <button className="btn btn-ghost" data-jump="analise">Ver análise completa</button>
          </div>
        </div>

        <div>
          <div className="card" style={{"marginBottom":"18px"}}>
            <div className="card-h"><h3>Timeline de calls</h3></div>
            <div className="timeline-item"><div className="timeline-dot"></div><div className="timeline-body"><div className="dt">05 JUN</div><div className="ti">Call estratégica</div><div className="de">Renata frustrada. "Não tô achando o que falar."</div></div></div>
            <div className="timeline-item"><div className="timeline-dot"></div><div className="timeline-body"><div className="dt">22 MAI</div><div className="ti">Mentoria pilar 3</div><div className="de">3ª tentativa. Travamento criativo confirmado.</div></div></div>
            <div className="timeline-item"><div className="timeline-dot"></div><div className="timeline-body"><div className="dt">08 MAI</div><div className="ti">Revisão Q1</div><div className="de">Primeiro mês de queda no faturamento.</div></div></div>
            <div className="timeline-item"><div className="timeline-dot"></div><div className="timeline-body"><div className="dt">15 ABR</div><div className="ti">Início pilar 3</div><div className="de">Começou animada. Caiu a ficha que era diferente dos anteriores.</div></div></div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Commitments da Renata</h3><span className="pill red">1 atrasado</span></div>
            <div className="list-item"><div className="ico red">!</div><div className="body"><div className="ti">Gravar 3 vídeos curtos com a técnica do roteirista</div><div className="de">Prometido 22/05 · prazo 30/05 · <strong style={{"color":"var(--red)"}}>8 dias atrasado</strong></div></div></div>
            <div className="list-item"><div className="ico amber">~</div><div className="body"><div className="ti">Mandar 5 ideias de pauta validadas</div><div className="de">Prometido 05/06 · prazo 12/06 · <strong>em andamento</strong></div></div></div>
            <div className="list-item"><div className="ico green">✓</div><div className="body"><div className="ti">Auditar últimos 30 posts (pilar 1)</div><div className="de">Cumprido em 18/05 · com atraso de 4 dias</div></div></div>
          </div>
        </div>
      </div>
    </section>

    {/*  ============ ANÁLISE DE CALL ============  */}
    <section className="page" id="page-analise">
      <div className="page-head">
        <h1 className="serif">Análise de <em>call</em></h1>
        <div className="sub">Suba o vídeo ou cole a transcrição. O Mentor de CS cruza com a trilha do mentorado e devolve as ações.</div>
      </div>

      <div className="editor">
        <div className="uploadbox">
          <div className="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <div className="info">
            <div className="ti">IMG_4213.MP4 · 20m30s · 176 MB</div>
            <div className="de">Carregado · transcrição automática concluída em 1m48s</div>
          </div>
          <span className="pill green">✓ Pronto pra analisar</span>
        </div>
        <div className="editor-h">
          <label>Mentorado:</label>
          <select className="select"><option>Doce Casa Digital · Renata</option><option>Marina Cordeiro</option><option>Studio Galo Roxo</option><option>Henrique Faria</option></select>
          <label>Tipo:</label>
          <select className="select"><option>Mentoria semanal</option><option>Call de resgate</option><option>Revisão de pilar</option><option>QBR</option></select>
          <span className="pill gold" style={{"marginLeft":"auto"}}>Transcrição auto · editar abaixo</span>
        </div>
        <textarea id="transcricao" defaultValue={`[exemplo de transcrição — substituir pelo texto real da call]

[00:00] Mentor: Renata, boa tarde. Como você tá chegando?
[00:18] Renata: Oi... olha, vou ser sincera. Tô meio mal. As vendas caíram de novo esse mês.
[00:42] Mentor: Quanto?
[00:48] Renata: Fechei 180 em maio. Tava em 240 no começo do ano.
[01:15] Mentor: E o conteúdo, como tá saindo?
[01:22] Renata: Caiu também. Eu tô travada, sabe? Sento pra gravar e não sai. Eu sei o que eu quero vender, sei a estratégia, mas na hora de falar... fica tudo igual aos outros vídeos. Engessado.
[02:10] Mentor: Você lembra do exercício do roteirista que a gente viu?
[02:18] Renata: Lembro, mas na hora de aplicar eu travo. Parece que eu tô performando, sabe? Não sai natural.
[03:45] Mentor: OK. Vamos fazer diferente. Quero que você grave 3 vídeos essa semana, mas usando só o gancho da curiosidade da aula 4. Sem se preocupar com produção.
[04:02] Renata: Tá. Mas é que semana passada eu já prometi gravar e não consegui...
[04:15] Mentor: Esse é o ponto. A gente precisa quebrar o ciclo. Posso te mandar um áudio com 3 ideias de gancho específicas pro teu nicho?
[04:30] Renata: Por favor.
[05:50] Mentor: E sobre o time? Você tá tentando fazer tudo sozinha de novo?
[06:02] Renata: Tô. A Bruna saiu mês passado e eu não consegui repor.
[07:30] Mentor: Renata, vamos combinar uma coisa. Até sexta você me manda 5 ideias de pauta usando o framework. Não precisa estar pronto. Cinco ideias.
[07:45] Renata: Combinado. Cinco ideias.`}></textarea>
        <div className="editor-f">
          <div style={{"color":"var(--muted)","fontSize":".78rem"}}>Cruzando com 6 calls anteriores da Doce Casa · pilares 1-3 da Imersão</div>
          <button className="btn btn-gold" id="btnAnalisar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 3l14 9-14 9V3z"/></svg>Analisar com Mentor de CS</button>
        </div>
      </div>

      <div className="loader" id="loader">
        <div className="spinner"></div>
        <div>O Mentor de CS está lendo a call e cruzando com a trilha da Renata na Imersão…</div>
      </div>

      <div className="report" id="report">
        <div className="report-h">
          <div>
            <div className="ti"><span className="em">Relatório do <em>Mentor</em></span></div>
            <div className="by">Doce Casa Digital · Renata Salles · cruzado com 6 calls anteriores e pilares 1-3</div>
          </div>
          <div className="ts">Gerado em 2.4s</div>
        </div>
        <div className="report-body">

          <div className="rsec">
            <div className="rsec-h">🎯 Resumo executivo</div>
            <p>Renata chegou frustrada e admitiu travamento criativo (3ª vez consecutiva). Não é problema de estratégia — ela domina pilares 1 e 2. <strong>O gargalo está no pilar 3 (Pensar como roteirista) e está custando faturamento real (R$ 60k a menos vs. início do ano).</strong> Há também sinal operacional: time desfalcado desde maio.</p>
          </div>

          <div className="rsec">
            <div className="rsec-h">🌡️ Health score</div>
            <p><strong style={{"color":"var(--red)"}}>Vermelho →</strong> mantido. Sem deterioração nova, mas sem recuperação. Pilares 1-2 sólidos, pilar 3 travado há 4 calls.</p>
          </div>

          <div className="rsec">
            <div className="rsec-h">🧱 Diagnóstico por pilar</div>
            <ul>
              <li>✅ <strong>Pilar 1 · Estratagemas</strong> — sem sinais de fragilidade. Renata sabe o que quer vender e por quê.</li>
              <li>✅ <strong>Pilar 2 · Comunicação</strong> — dominado. Negociação interna com time funcionava bem (antes da saída da Bruna).</li>
              <li>🔴 <strong>Pilar 3 · Pensar como roteirista</strong> — bloqueio criativo confirmado.<div className="quote">"Eu sei o que eu quero vender, sei a estratégia, mas na hora de falar... fica tudo igual aos outros vídeos. Engessado."</div>Sintoma clássico de quem aprende framework mas não internalizou. Tentar avançar antes de destravar é jogar fora os próximos pilares.</li>
            </ul>
          </div>

          <div className="rsec">
            <div className="rsec-h">🚩 Outros riscos</div>
            <ul>
              <li><strong>[MÉDIO] Time desfalcado.</strong><div className="quote">"A Bruna saiu mês passado e eu não consegui repor."</div>Sobrecarga operacional pode estar amplificando o bloqueio criativo.</li>
              <li><strong>[MÉDIO] Padrão de descumprimento de commitments.</strong> Renata mesma admitiu: "semana passada eu já prometi gravar e não consegui". Isso é o 3º commitment de gravação não cumprido nos últimos 30 dias.</li>
            </ul>
          </div>

          <div className="rsec">
            <div className="rsec-h">🔄 Status dos commitments anteriores</div>
            <ul>
              <li>🔴 <strong>Gravar 3 vídeos com técnica do roteirista</strong> · prazo 30/05 · não cumprido · <em>renegociado nesta call</em></li>
              <li>🟡 <strong>Auditar 30 posts do feed</strong> · cumprido com atraso · sem problema</li>
              <li>🔴 <strong>Repor vaga da Bruna</strong> · prazo 25/05 · não cumprido · <em>não mencionado nesta call</em></li>
            </ul>
          </div>

          <div className="rsec">
            <div className="rsec-h">📌 Novos commitments desta call</div>
            <ul>
              <li><strong>Renata</strong> · enviar 5 ideias de pauta usando o framework · prazo sexta (09/jun) · <span className="pill amber">Confiança MÉDIA</span> (pediu pra ser menor, sinal positivo)</li>
              <li><strong>Renata</strong> · gravar 3 vídeos com gancho de curiosidade da aula 4 · prazo "essa semana" · <span className="pill red">Confiança BAIXA</span> (4º compromisso seguido de gravação)</li>
              <li><strong>Nosso lado</strong> · enviar áudio com 3 ideias de gancho · prazo 24h · <span className="pill green">Confiança ALTA</span></li>
            </ul>
          </div>

          <div className="rsec">
            <div className="rsec-h">💡 Insight não-óbvio</div>
            <p className="serif" style={{"fontSize":"1.2rem","color":"var(--navy-800)","lineHeight":"1.45"}}>
              "Renata <em>não está com problema de produto</em> — ela tem audiência e marca. Está com problema <em>identitário</em>: o roteirista exige expor uma voz pessoal, e ela construiu o e-commerce em cima de uma persona impessoal de loja. Pode ser que o pilar 3 precise ser trabalhado em paralelo a uma conversa sobre <em>quem fala</em> nos vídeos, antes de <em>o que falar</em>."
            </p>
          </div>

          <div className="rsec">
            <div className="rsec-h">✅ Próximas ações (priorizadas)</div>
            <ul>
              <li><strong>1.</strong> Enviar áudio com 3 ganchos específicos · até amanhã 12h</li>
              <li><strong>2.</strong> Marcar call extra de 30min focada SÓ no pilar 3, com exercício prático ao vivo · até 13/jun</li>
              <li><strong>3.</strong> Não puxar conversa sobre time/Bruna na próxima call — Renata precisa de uma vitória criativa primeiro</li>
              <li><strong>4.</strong> Se até 14/jun não houver gravação entregue, escalar pra call de resgate com a sócia (se houver)</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    {/*  ============ COMMITMENTS ============  */}
    <section className="page" id="page-commitments">
      <div className="page-head">
        <h1 className="serif">Commitments <em>em movimento</em></h1>
        <div className="sub">11 commitments ativos · 3 atrasados · cada um vinculado a um pilar da Imersão</div>
      </div>

      <div className="kanban">
        <div className="kcol">
          <div className="kcol-h"><span className="kdot b"></span><span className="nm">Aberto</span><span className="ct">4</span></div>
          <div className="kcard"><div className="men">Henrique Faria</div><div className="txt">Testar 2 capas diferentes pra mesma aula gratuita</div><span className="pilar">Pilar 4 · Edição magnética</span><div className="ft"><span>Henrique</span><span className="pz">10/jun</span></div></div>
          <div className="kcard"><div className="men">Marina Cordeiro</div><div className="txt">Mapear 12 temas pra calendário do 2º semestre</div><span className="pilar">Pilar 6 · Calendário</span><div className="ft"><span>Marina</span><span className="pz">14/jun</span></div></div>
          <div className="kcard"><div className="men">Studio Galo Roxo</div><div className="txt">Reescrever pitch da reunião com cliente novo</div><span className="pilar">Pilar 2 · Comunicação</span><div className="ft"><span>Henrique S.</span><span className="pz">11/jun</span></div></div>
          <div className="kcard"><div className="men">Doce Casa</div><div className="txt">Enviar áudio com 3 ganchos de curiosidade</div><span className="pilar">Pilar 3 · Roteirista</span><div className="ft"><span>Nosso lado</span><span className="pz">amanhã</span></div></div>
        </div>

        <div className="kcol">
          <div className="kcol-h"><span className="kdot y"></span><span className="nm">Em andamento</span><span className="ct">4</span></div>
          <div className="kcard"><div className="men">Doce Casa</div><div className="txt">5 ideias de pauta usando framework</div><span className="pilar">Pilar 3 · Roteirista</span><div className="ft"><span>Renata</span><span className="pz">09/jun</span></div></div>
          <div className="kcard"><div className="men">Marina Cordeiro</div><div className="txt">Reescrever oferta do mentoria premium</div><span className="pilar">Pilar 2 · Comunicação</span><div className="ft"><span>Marina</span><span className="pz">12/jun</span></div></div>
          <div className="kcard"><div className="men">Henrique Faria</div><div className="txt">Roteirizar série de 5 reels da semana de lançamento</div><span className="pilar">Pilar 3 · Roteirista</span><div className="ft"><span>Henrique</span><span className="pz">15/jun</span></div></div>
          <div className="kcard"><div className="men">Studio Galo</div><div className="txt">Testar funil de baixo ticket pra agência</div><span className="pilar">Pilar 7 · Funil</span><div className="ft"><span>Letícia</span><span className="pz">20/jun</span></div></div>
        </div>

        <div className="kcol">
          <div className="kcol-h"><span className="kdot r"></span><span className="nm">Atrasado</span><span className="ct">3</span></div>
          <div className="kcard" style={{"borderLeft":"3px solid var(--red)"}}><div className="men">Doce Casa</div><div className="txt">Gravar 3 vídeos com técnica do roteirista</div><span className="pilar">Pilar 3 · Roteirista</span><div className="ft"><span>Renata</span><span className="pz" style={{"color":"var(--red)"}}>8 dias atrasado</span></div></div>
          <div className="kcard" style={{"borderLeft":"3px solid var(--red)"}}><div className="men">Marina Cordeiro</div><div className="txt">Postar pelo menos 3x por semana</div><span className="pilar">Pilar 6 · Calendário</span><div className="ft"><span>Marina</span><span className="pz" style={{"color":"var(--red)"}}>10 dias sem post</span></div></div>
          <div className="kcard" style={{"borderLeft":"3px solid var(--red)"}}><div className="men">Doce Casa</div><div className="txt">Repor vaga da Bruna no time</div><span className="pilar">Operacional</span><div className="ft"><span>Renata</span><span className="pz" style={{"color":"var(--red)"}}>14 dias · esquecido</span></div></div>
        </div>

        <div className="kcol">
          <div className="kcol-h"><span className="kdot g"></span><span className="nm">Cumprido</span><span className="ct">+32</span></div>
          <div className="kcard" style={{"opacity":".7"}}><div className="men">Henrique Faria</div><div className="txt">Estruturar oferta de pré-lançamento</div><span className="pilar">Pilar 1 · Estratagemas</span><div className="ft"><span>Henrique</span><span className="pz" style={{"color":"var(--green)"}}>✓ adiantado</span></div></div>
          <div className="kcard" style={{"opacity":".7"}}><div className="men">Studio Galo</div><div className="txt">Aplicar técnica do mosaico em 1 cliente</div><span className="pilar">Pilar 5 · Mosaico</span><div className="ft"><span>Letícia</span><span className="pz" style={{"color":"var(--green)"}}>✓ no prazo</span></div></div>
          <div className="kcard" style={{"opacity":".7"}}><div className="men">Marina</div><div className="txt">Lançar mini-curso de teste</div><span className="pilar">Pilar 7 · Funil</span><div className="ft"><span>Marina</span><span className="pz" style={{"color":"var(--green)"}}>✓ +R$ 18k</span></div></div>
        </div>
      </div>
    </section>

    {/*  ============ ALERTAS ============  */}
    <section className="page" id="page-alertas">
      <div className="page-head">
        <h1 className="serif">Alertas <em>ativos</em></h1>
        <div className="sub">4 alertas que pedem ação humana · ordenados por severidade</div>
      </div>

      <div className="card">
        <div className="alert-row">
          <div className="alert-sev h"></div>
          <div className="alert-body">
            <div className="ti">Doce Casa Digital: faturamento em queda 3º mês seguido</div>
            <div className="de">R$ 240k → R$ 195k → R$ 180k. Renata travada no pilar 3 (Pensar como roteirista) há 4 calls. Padrão de descumprimento crescente — 3 commitments de gravação não cumpridos em 30 dias.</div>
            <div className="meta"><span>🚨 Alta severidade</span><span>·</span><span>Detectado pelo Mentor de CS</span><span>·</span><span>hoje</span></div>
          </div>
          <div className="alert-actions"><button className="btn">Acionar resgate</button><button className="btn btn-ghost">Atribuir</button></div>
        </div>

        <div className="alert-row">
          <div className="alert-sev m"></div>
          <div className="alert-body">
            <div className="ti">3 mentorados travam no MESMO pilar (Pensar como roteirista)</div>
            <div className="de">Renata, Letícia e — começando — Marina. Padrão consistente: aprendem o framework, mas não conseguem aplicar em produção criativa. Considerar sessão coletiva ou conteúdo extra.</div>
            <div className="meta"><span>⚠️ Padrão sistêmico</span><span>·</span><span>Detectado pelo Mentor de CS</span><span>·</span><span>ontem</span></div>
          </div>
          <div className="alert-actions"><button className="btn btn-gold">Planejar sessão coletiva</button><button className="btn btn-ghost">Snooze 7d</button></div>
        </div>

        <div className="alert-row">
          <div className="alert-sev m"></div>
          <div className="alert-body">
            <div className="ti">Marina Cordeiro: 10 dias sem postar</div>
            <div className="de">Última call mencionou "não tô achando o que falar". Possível início do mesmo bloqueio criativo da Renata, mas em estágio inicial — janela boa pra intervenção preventiva.</div>
            <div className="meta"><span>⚠️ Média severidade</span><span>·</span><span>Detectado automaticamente</span><span>·</span><span>ontem</span></div>
          </div>
          <div className="alert-actions"><button className="btn">Agendar check-in</button><button className="btn btn-ghost">Snooze 3d</button></div>
        </div>

        <div className="alert-row">
          <div className="alert-sev l"></div>
          <div className="alert-body">
            <div className="ti">Henrique Faria: oportunidade de upsell pra programa avançado</div>
            <div className="de">Avançou 3 pilares em 90 dias (recorde da carteira). Mencionou na última call que quer "ir mais fundo". Candidato natural pra mentoria 1:1 premium da CD Grupo.</div>
            <div className="meta"><span>💡 Oportunidade</span><span>·</span><span>Detectado pelo Mentor de CS</span><span>·</span><span>2d atrás</span></div>
          </div>
          <div className="alert-actions"><button className="btn btn-gold">Preparar upsell</button><button className="btn btn-ghost">Snooze</button></div>
        </div>
      </div>
    </section>

  </div>
</div>


    </>
  );
}
