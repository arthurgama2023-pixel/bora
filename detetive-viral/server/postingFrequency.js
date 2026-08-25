// ══════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO DE FREQUÊNCIA DE POSTAGEM
//
// Calcula a partir dos posts recentes (latestPosts do scraper): quantos posts/
// semana, o intervalo TÍPICO entre eles, o nível, o melhor horário (por
// engajamento) e o engajamento médio.
//
// IMPORTANTE — por que MEDIANA e não média:
// A média do intervalo sobre todo o período é distorcida por UM post antigo
// isolado na amostra (um post fixado/pinned, ou uma pausa pontual no passado).
// Esse outlier estica o intervalo e faz quem posta MUITO parecer "baixa". A
// mediana do intervalo entre posts consecutivos ignora esse outlier e reflete
// o ritmo real de publicação.
// ══════════════════════════════════════════════════════════════════════════════

function computePostingFrequency(latestPosts) {
  const postsWithData = (latestPosts || [])
    .filter((p) => p.timestamp && !isNaN(new Date(p.timestamp).getTime()))
    .map((p) => ({
      ts: new Date(p.timestamp).getTime(),
      engagement: (p.likesCount || 0) + (p.commentsCount || 0),
    }))
    .sort((a, b) => b.ts - a.ts);

  if (postsWithData.length < 2) return null;

  // Remove posts muito antigos (>6 meses): são outliers fixados/pinned que
  // distorcem o cálculo de frequência. Mantém apenas os recentes.
  const now = Date.now();
  const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000;
  const recentPosts = postsWithData.filter((p) => p.ts >= sixMonthsAgo);
  const allPostsForMonthChart = postsWithData; // mantém TODOS para o gráfico de meses

  const postTimestamps = recentPosts.map((p) => p.ts); // apenas posts recentes (últimos 6 meses)
  if (postTimestamps.length < 2) return null; // precisa de >= 2 posts recentes

  // Intervalo entre posts CONSECUTIVOS (em dias) → MEDIANA (robusta a outlier).
  const gapsDays = [];
  for (let i = 0; i < postTimestamps.length - 1; i++) {
    gapsDays.push((postTimestamps[i] - postTimestamps[i + 1]) / 86400000);
  }
  const sortedGaps = [...gapsDays].sort((a, b) => a - b);
  const mid = Math.floor(sortedGaps.length / 2);
  const medianGap = sortedGaps.length % 2
    ? sortedGaps[mid]
    : (sortedGaps[mid - 1] + sortedGaps[mid]) / 2;

  const avgDaysBetween = medianGap;
  // Teto de 50 posts/semana (~7/dia): evita números absurdos quando a amostra
  // tem uma rajada de posts no mesmo dia (mediana do intervalo ≈ 0). Acima de
  // 14 já é "muito_alta", então o teto não muda o diagnóstico — só a exibição.
  const postsPerWeek = medianGap > 0 ? Math.min(7 / medianGap, 50) : 50;
  const avgEngagementPerPost = Math.round(
    recentPosts.reduce((sum, p) => sum + p.engagement, 0) / recentPosts.length
  );

  // Diagnóstico de nível — referência: 3-7 posts/semana é a faixa saudável p/ crescer no IG.
  let level, diagnosis;
  if (postsPerWeek < 1) {
    level = 'muito_baixa';
    diagnosis = 'Frequência muito baixa. O algoritmo do Instagram perde o "fio" do seu perfil entre um post e outro, dificultando alcance e crescimento.';
  } else if (postsPerWeek < 3) {
    level = 'baixa';
    diagnosis = 'Frequência baixa. Postar mais regularmente ajudaria o algoritmo a entregar seu conteúdo pra mais gente.';
  } else if (postsPerWeek <= 7) {
    level = 'moderada';
    diagnosis = 'Frequência moderada — dentro da faixa recomendada para manter o algoritmo ativo no seu perfil.';
  } else if (postsPerWeek <= 14) {
    level = 'alta';
    diagnosis = 'Frequência alta. Bom ritmo de produção, desde que a qualidade dos posts se mantenha.';
  } else {
    level = 'muito_alta';
    diagnosis = 'Frequência muito alta. Atenção pra não cansar a audiência — qualidade tende a pesar mais que quantidade nesse ritmo.';
  }

  // Melhor horário: agrupa os posts RECENTES por janela do dia (fuso BRT, UTC-3)
  // e aponta a janela com maior engajamento médio.
  const windows = [
    { label: 'Madrugada (00h–06h)', from: 0, to: 6 },
    { label: 'Manhã (06h–12h)', from: 6, to: 12 },
    { label: 'Tarde (12h–18h)', from: 12, to: 18 },
    { label: 'Noite (18h–24h)', from: 18, to: 24 },
  ].map((w) => ({ ...w, total: 0, count: 0 }));

  recentPosts.forEach((p) => {
    const brtHour = (new Date(p.ts).getUTCHours() - 3 + 24) % 24;
    const win = windows.find((w) => brtHour >= w.from && brtHour < w.to);
    if (win) { win.total += p.engagement; win.count += 1; }
  });

  const withSamples = windows.filter((w) => w.count > 0);
  const bestWindow = withSamples.length > 0
    ? withSamples.reduce((best, w) => (w.total / w.count > best.total / best.count ? w : best))
    : null;

  // Contagem REAL (não estimada) por mês de publicação, em fuso BRT (UTC-3).
  // Inclui TODOS os meses dos últimos 6 meses (mesmo com 0 posts) pra visualizar
  // as pausas reais de postagem — essencial pra diferenciar "pausa de 2 meses" vs
  // "posta todo dia". Mostra o padrão temporal completo.
  const monthCounts = new Map();
  recentPosts.forEach((p) => {
    const d = new Date(p.ts);
    const brtTime = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    const key = `${brtTime.getUTCFullYear()}-${String(brtTime.getUTCMonth() + 1).padStart(2, '0')}`;
    monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  });

  // Preenche os meses vazios (sem posts) para mostrar o período completo.
  // IMPORTANTE: usar getUTCMonth/getUTCFullYear (não getMonth/getFullYear) porque
  // getMonth() usa timezone LOCAL e pode dessincroniazar com os timestamps calculados em UTC.
  const sixMonthsAgoMs = now - 6 * 30 * 24 * 60 * 60 * 1000;
  const allMonths = new Map();
  for (let d = new Date(sixMonthsAgoMs); d.getTime() <= now; ) {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    allMonths.set(key, monthCounts.get(key) || 0);
    d.setUTCMonth(d.getUTCMonth() + 1); // incrementa para próximo mês (UTC)
  }

  const MES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const postsByMonth = [...allMonths.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([key, count]) => {
      const [year, month] = key.split('-');
      return { month: key, label: `${MES_PT[Number(month) - 1]}/${year.slice(2)}`, count };
    });

  return {
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
    avgDaysBetween: Math.round(avgDaysBetween * 10) / 10,
    sampleSize: postTimestamps.length,
    oldestSample: new Date(postTimestamps[postTimestamps.length - 1]).toISOString(),
    newestSample: new Date(postTimestamps[0]).toISOString(),
    note: recentPosts.length < allPostsForMonthChart.length ? `Cálculo com ${recentPosts.length} posts recentes (últimos 6 meses); ${allPostsForMonthChart.length - recentPosts.length} posts antigos/pinned ignorados na frequência` : undefined,
    level,
    diagnosis,
    avgEngagementPerPost,
    bestWindow: bestWindow ? { label: bestWindow.label, avgEngagement: Math.round(bestWindow.total / bestWindow.count) } : null,
    postsByMonth,
  };
}

module.exports = { computePostingFrequency };
