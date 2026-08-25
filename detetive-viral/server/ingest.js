// ══════════════════════════════════════════════════════════════════════════════
// INGESTÃO — Fase A da Arquitetura V2 (ver ARQUITETURA_BUSCA_V2.md §3 e §5)
//
// Persiste TODA coleta FRESCA do Apify (dados de cache não são nova observação):
//   1) upsert no catálogo `videos`
//   2) snapshot em `video_snapshots` → série temporal → velocity real
//   3) criadores em `creators` (infra de reputação/watchlist)
//   4) Viral Score v3 recalculado para o lote
//
// NUNCA lança: falha aqui não pode derrubar a busca do usuário (mesma
// filosofia do logActivity).
// ══════════════════════════════════════════════════════════════════════════════

const { pool, sanitizeJsonString } = require('./db');
const { scoreV3 } = require('./viralScore');

const MIN_SNAPSHOT_GAP_MIN = 30; // re-observação < 30min é ruído, não sinal

// Remove surrogates UTF-16 órfãos (emoji cortado) que o Postgres rejeita em TEXT
const stripLone = (s) => (s || '')
  .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
  .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');

// Reduz o reel bruto ao que a V2 usa. O raw completo (latestComments, images,
// childPosts) inflaria o banco — e o blob inteiro já vive em cache_entries.
function slimRaw(p) {
  return {
    url: p.url, displayUrl: p.displayUrl, videoUrl: p.videoUrl,
    hashtags: p.hashtags, musicInfo: p.musicInfo,
  };
}

async function ingestReels(reels, nicheKey) {
  try {
    // 1) Normaliza + dedup por shortcode dentro do lote
    const byCode = new Map();
    for (const p of reels || []) {
      const code = p.shortCode || p.id;
      if (!code || (p.type !== 'Video' && !p.videoUrl)) continue;
      if (!byCode.has(code)) byCode.set(code, p);
    }
    const items = [...byCode.entries()].map(([code, p]) => ({
      code,
      owner: p.ownerUsername || null,
      caption: stripLone((p.caption || '').slice(0, 2000)),
      audioId: p.musicInfo?.audio_id || null,
      duration: p.videoDuration || null,
      postedAt: p.timestamp ? new Date(p.timestamp) : null,
      views: p.videoPlayCount || p.igPlayCount || 0,
      likes: p.likesCount || 0,
      comments: p.commentsCount || 0,
      raw: slimRaw(p),
    }));
    if (!items.length) return { ingested: 0 };
    const codes = items.map(i => i.code);

    // 2) UPSERT no catálogo (lotes de 100 — 8 params/linha)
    for (let off = 0; off < items.length; off += 100) {
      const chunk = items.slice(off, off + 100);
      const vals = [], params = [];
      chunk.forEach((it, i) => {
        const n = i * 8;
        vals.push(`($${n+1},$${n+2},$${n+3},$${n+4},$${n+5},$${n+6},$${n+7},$${n+8}::jsonb)`);
        params.push(it.code, nicheKey, it.owner, it.caption, it.audioId,
                    it.duration, it.postedAt, sanitizeJsonString(JSON.stringify(it.raw)));
      });
      await pool.query(`
        INSERT INTO videos (shortcode, niche_key, owner_username, caption, audio_id, video_duration, posted_at, raw)
        VALUES ${vals.join(',')}
        ON CONFLICT (shortcode) DO UPDATE SET niche_key = COALESCE(videos.niche_key, EXCLUDED.niche_key)
      `, params);
    }

    // 3) Criadores (reputação começa em 0; followers vem na watchlist/Fase C)
    const owners = [...new Set(items.map(i => i.owner).filter(Boolean))];
    if (owners.length) {
      await pool.query(`
        INSERT INTO creators (username, niche_key)
        SELECT unnest($1::text[]), $2
        ON CONFLICT (username) DO NOTHING
      `, [owners, nicheKey]);
    }

    // 4) Snapshots — pula vídeo observado há menos de 30min
    const lastSnap = await pool.query(`
      SELECT shortcode, MAX(captured_at) AS last FROM video_snapshots
      WHERE shortcode = ANY($1) GROUP BY shortcode
    `, [codes]);
    const lastByCode = new Map(lastSnap.rows.map(r => [r.shortcode, new Date(r.last).getTime()]));
    const cutoff = Date.now() - MIN_SNAPSHOT_GAP_MIN * 60000;
    const toSnap = items.filter(i => !lastByCode.has(i.code) || lastByCode.get(i.code) < cutoff);
    for (let off = 0; off < toSnap.length; off += 200) {
      const chunk = toSnap.slice(off, off + 200);
      const vals = [], params = [];
      chunk.forEach((it, i) => {
        const n = i * 4;
        vals.push(`($${n+1}, NOW(), $${n+2}, $${n+3}, $${n+4})`);
        params.push(it.code, it.views, it.likes, it.comments);
      });
      await pool.query(`
        INSERT INTO video_snapshots (shortcode, captured_at, views, likes, comments)
        VALUES ${vals.join(',')} ON CONFLICT DO NOTHING
      `, params);
    }

    // 5) Sinais de contexto p/ o score:
    //    a) áudio em ascensão no nicho (C4 "light", R$0 — musicInfo já vem nos reels)
    const audio = await pool.query(`
      SELECT audio_id, COUNT(DISTINCT owner_username)::int AS c FROM videos
      WHERE niche_key = $1 AND audio_id IS NOT NULL
        AND first_seen_at > NOW() - INTERVAL '7 days'
      GROUP BY audio_id HAVING COUNT(DISTINCT owner_username) >= 2
    `, [nicheKey]);
    const audioMap = new Map(audio.rows.map(r => [r.audio_id, r.c]));
    //    b) reputação/followers dos criadores do lote
    const reps = owners.length ? await pool.query(
      `SELECT username, reputation, followers FROM creators WHERE username = ANY($1)`, [owners]
    ) : { rows: [] };
    const repMap = new Map(reps.rows.map(r => [r.username, r]));

    // 6) Score v3 sobre os últimos 3 snapshots de cada vídeo
    const snaps = await pool.query(`
      SELECT shortcode, captured_at, views, likes, comments FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY shortcode ORDER BY captured_at DESC) rn
        FROM video_snapshots WHERE shortcode = ANY($1)
      ) t WHERE rn <= 3 ORDER BY shortcode, captured_at DESC
    `, [codes]);
    const snapsByCode = new Map();
    for (const r of snaps.rows) {
      if (!snapsByCode.has(r.shortcode)) snapsByCode.set(r.shortcode, []);
      snapsByCode.get(r.shortcode).push(r);
    }

    const upCodes = [], upScores = [], upBreak = [];
    let measured = 0;
    for (const it of items) {
      const vsnaps = snapsByCode.get(it.code) ||
        [{ captured_at: new Date(), views: it.views, likes: it.likes, comments: it.comments }];
      const rep = repMap.get(it.owner);
      const { score, breakdown } = scoreV3({ posted_at: it.postedAt }, vsnaps, {
        audioCreators7d: it.audioId ? (audioMap.get(it.audioId) || 0) : 0,
        reputation: rep ? Number(rep.reputation) : 0,
        followers: rep ? Number(rep.followers) : 0,
      });
      if (breakdown.mode === 'measured') measured++;
      upCodes.push(it.code); upScores.push(score); upBreak.push(JSON.stringify(breakdown));
    }
    await pool.query(`
      UPDATE videos v SET viral_score = u.score, score_breakdown = u.bd::jsonb, last_snapshot_at = NOW()
      FROM (SELECT unnest($1::text[]) code, unnest($2::real[]) score, unnest($3::text[]) bd) u
      WHERE v.shortcode = u.code
    `, [upCodes, upScores, upBreak]);

    console.log(`[Ingest] 💾 ${items.length} vídeos persistidos (${nicheKey}) — ${toSnap.length} snapshots novos, ${measured} com velocity MEDIDA`);
    return { ingested: items.length, snapshots: toSnap.length, measured };
  } catch (e) {
    console.warn('[Ingest] ⚠️ Falhou (busca do usuário segue normal):', e.message);
    return { ingested: 0, error: e.message };
  }
}

module.exports = { ingestReels };
