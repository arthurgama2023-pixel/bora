// Motor de Operations: aplica transações ao TimelineDoc de forma imutável,
// calcula as operações INVERSAS (undo = aplicar a inversa) e valida invariantes.
// Usuário e Editor IA passam pelo MESMO caminho — este arquivo é a garantia de
// que a IA nunca corrompe a timeline e de que tudo é reversível.
// ISOMÓRFICO: roda no servidor e no browser (sem imports de node:*).
import {
  ApplyResult,
  Clip,
  Operation,
  TimelineDoc,
  TimelineError,
  Track,
  Transaction,
} from "./types";

const newId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
const clone = <T>(x: T): T => structuredClone(x);

// Faixas em que clips PODEM se sobrepor no tempo (camadas visuais/sonoras livres)
const OVERLAP_OK = new Set(["overlay", "effect", "sfx", "image", "text"]);

function clipById(doc: TimelineDoc, id: string): Clip {
  const c = doc.clips.find((c) => c.id === id);
  if (!c) throw new TimelineError(`Clip não encontrado: ${id}`);
  return c;
}

function trackById(doc: TimelineDoc, id: string): Track {
  const t = doc.tracks.find((t) => t.id === id);
  if (!t) throw new TimelineError(`Track não encontrada: ${id}`);
  return t;
}

// Coloca um clip de duração `dur` na posição livre mais próxima de `desired` na
// faixa, sem sobrepor as vizinhas (usado só em faixas não-magnéticas/não-livres,
// ex.: B-roll/narração/música). Evita o erro "Sobreposição" ao mover.
function placeInGap(doc: TimelineDoc, clipId: string, trackId: string, desired: number, dur: number): number {
  const others = doc.clips
    .filter((x) => x.trackId === trackId && x.id !== clipId)
    .sort((a, b) => a.tIn - b.tIn);
  const gaps: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const o of others) {
    if (o.tIn - cursor >= dur - 1e-6) gaps.push({ start: cursor, end: o.tIn });
    cursor = Math.max(cursor, o.tOut);
  }
  gaps.push({ start: cursor, end: Infinity }); // após a última vizinha
  let best = cursor;
  let bestD = Infinity;
  for (const g of gaps) {
    const hi = g.end === Infinity ? Infinity : g.end - dur;
    if (hi < g.start) continue; // gap pequeno demais
    const placed = Math.min(Math.max(desired, g.start), hi);
    const d = Math.abs(placed - desired);
    if (d < bestD) {
      bestD = d;
      best = placed;
    }
  }
  return best;
}

export function recomputeDuration(doc: TimelineDoc) {
  doc.meta.duration = doc.clips.reduce((m, c) => Math.max(m, c.tOut), 0);
}

// ============ Validação de invariantes ============
export function validateDoc(doc: TimelineDoc) {
  const trackIds = new Set(doc.tracks.map((t) => t.id));
  const assetIds = new Set(doc.assets.map((a) => a.id));
  const byTrack = new Map<string, Clip[]>();

  for (const c of doc.clips) {
    if (!trackIds.has(c.trackId)) throw new TimelineError(`Clip ${c.id} referencia track inexistente.`);
    if (c.assetId && !assetIds.has(c.assetId)) throw new TimelineError(`Clip ${c.id} referencia asset inexistente.`);
    if (!(c.tOut > c.tIn)) throw new TimelineError(`Clip ${c.id} com duração inválida (${c.tIn}→${c.tOut}).`);
    if (c.tIn < 0) throw new TimelineError(`Clip ${c.id} com tIn negativo.`);
    if (c.srcIn !== undefined && c.srcOut !== undefined && !(c.srcOut > c.srcIn)) {
      throw new TimelineError(`Clip ${c.id} com janela de asset inválida.`);
    }
    if (c.speed < 0.25 || c.speed > 4) throw new TimelineError(`Clip ${c.id} com speed fora de 0.25..4.`);
    const arr = byTrack.get(c.trackId) ?? [];
    arr.push(c);
    byTrack.set(c.trackId, arr);
  }

  // Sem sobreposição na mesma faixa (exceto faixas de camada livre)
  for (const [trackId, clips] of byTrack) {
    const track = trackById(doc, trackId);
    if (OVERLAP_OK.has(track.kind)) continue;
    const sorted = [...clips].sort((a, b) => a.tIn - b.tIn);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].tIn < sorted[i - 1].tOut - 0.001) {
        throw new TimelineError(
          `Sobreposição na faixa "${track.name}": ${sorted[i - 1].id} e ${sorted[i].id}.`
        );
      }
    }
  }
}

// ============ Aplicação de uma operação (muta o doc-cópia; retorna inversa) ============
function applyOp(doc: TimelineDoc, op: Operation): Operation {
  switch (op.op) {
    case "clip.add": {
      doc.clips.push(clone(op.clip));
      return { op: "clip.remove", clipId: op.clip.id };
    }
    case "clip.remove": {
      const c = clipById(doc, op.clipId);
      doc.clips = doc.clips.filter((x) => x.id !== op.clipId);
      return { op: "clip.add", clip: clone(c) };
    }
    case "clip.move": {
      const c = clipById(doc, op.clipId);
      const inverse: Operation = { op: "clip.move", clipId: c.id, tIn: c.tIn, trackId: c.trackId };
      const dur = c.tOut - c.tIn;
      if (op.trackId) {
        const target = trackById(doc, op.trackId);
        if (target.locked) throw new TimelineError(`Faixa "${target.name}" está bloqueada.`);
        c.trackId = op.trackId;
      }
      let tIn = Math.max(0, op.tIn);
      // Faixas não-magnéticas e não-livres: encaixa na lacuna mais próxima em vez
      // de sobrepor (vídeo é ripple; overlay/image/text/sfx aceitam sobreposição).
      const track = doc.tracks.find((t) => t.id === c.trackId);
      if (track && track.kind !== "video" && !OVERLAP_OK.has(track.kind)) {
        tIn = placeInGap(doc, c.id, c.trackId, tIn, dur);
      }
      c.tIn = +tIn.toFixed(3);
      c.tOut = +(tIn + dur).toFixed(3);
      return inverse;
    }
    case "clip.trim": {
      const c = clipById(doc, op.clipId);
      const inverse: Operation = {
        op: "clip.trim",
        clipId: c.id,
        edge: op.edge,
        t: op.edge === "in" ? c.tIn : c.tOut,
      };
      const hasSrc = c.srcIn !== undefined && c.srcOut !== undefined;
      const MIN = 0.1; // duração mínima do clip/janela
      // Faixas não-magnéticas e não-livres (ex.: legenda) não podem sobrepor a
      // vizinha — a alça PARA nela (clamp) em vez de gerar erro. Vídeo é ripple
      // (repac­ka depois); overlay/image/text/sfx permitem sobreposição.
      const track = doc.tracks.find((t) => t.id === c.trackId);
      const constrained = !!track && track.kind !== "video" && !OVERLAP_OK.has(track.kind);
      const same = constrained
        ? doc.clips.filter((x) => x.trackId === c.trackId && x.id !== c.id)
        : [];

      if (op.edge === "in") {
        // intervalo válido do NOVO tIn: [lo, hi]
        let lo = 0;
        for (const o of same) if (o.tOut <= c.tOut + 5e-4 && o.tOut > lo) lo = o.tOut; // vizinha anterior
        let hi = c.tOut - MIN;
        if (hasSrc) {
          lo = Math.max(lo, c.tIn - c.srcIn! / c.speed); // srcIn não vai antes de 0
          hi = Math.min(hi, c.tIn + (c.srcOut! - MIN * c.speed - c.srcIn!) / c.speed);
        }
        const t = Math.min(Math.max(op.t, lo), hi);
        if (hasSrc) c.srcIn = +(c.srcIn! + (t - c.tIn) * c.speed).toFixed(3);
        c.tIn = +Math.max(0, t).toFixed(3);
      } else {
        // intervalo válido do NOVO tOut: [lo, hi]
        let hi = Infinity;
        for (const o of same) if (o.tIn >= c.tIn - 5e-4 && o.tIn < hi) hi = o.tIn; // próxima vizinha
        let lo = c.tIn + MIN;
        if (hasSrc) {
          const asset = doc.assets.find((a) => a.id === c.assetId);
          const maxSrc = asset ? asset.probe.duration : Infinity;
          hi = Math.min(hi, c.tOut + (maxSrc - c.srcOut!) / c.speed); // srcOut não passa do fim do material
          lo = Math.max(lo, c.tOut + (c.srcIn! + MIN * c.speed - c.srcOut!) / c.speed);
        }
        const t = Math.max(Math.min(op.t, hi), lo);
        if (hasSrc) c.srcOut = +(c.srcOut! + (t - c.tOut) * c.speed).toFixed(3);
        c.tOut = +t.toFixed(3);
      }
      return inverse;
    }
    case "clip.split": {
      const c = clipById(doc, op.clipId);
      if (op.t <= c.tIn + 0.05 || op.t >= c.tOut - 0.05) {
        throw new TimelineError("Ponto de divisão muito próximo da borda do clip.");
      }
      const original = clone(c);
      const rightId = op.newClipId ?? `c_${newId()}`;
      const offset = (op.t - c.tIn) * c.speed;
      const right: Clip = {
        ...clone(c),
        id: rightId,
        tIn: op.t,
        tOut: c.tOut,
        srcIn: c.srcIn !== undefined ? +(c.srcIn + offset).toFixed(3) : undefined,
      };
      // divide as words da legenda entre os dois lados
      if (c.props.words) {
        right.props = { ...right.props, words: c.props.words.filter((w) => w.t0 >= op.t) };
        c.props = { ...c.props, words: c.props.words.filter((w) => w.t0 < op.t) };
        if (right.props.words && c.props.text) {
          right.props.text = right.props.words.map((w) => w.w).join(" ");
          c.props.text = (c.props.words ?? []).map((w) => w.w).join(" ");
        }
      }
      c.tOut = op.t;
      if (c.srcIn !== undefined) c.srcOut = +(c.srcIn + offset).toFixed(3);
      doc.clips.push(right);
      return { op: "clip.restore", removeIds: [c.id, rightId], addClips: [original] };
    }
    case "clip.setProps": {
      const c = clipById(doc, op.clipId);
      const before: Record<string, unknown> = {};
      const patch = op.patch as Record<string, unknown>;
      const target = c as unknown as Record<string, unknown>;
      for (const key of Object.keys(patch)) {
        before[key] = clone(target[key]);
        if (key === "props" || key === "transform" || key === "transitions") {
          target[key] = { ...(target[key] as object), ...(patch[key] as object) };
        } else {
          target[key] = patch[key];
        }
      }
      return { op: "clip.setProps", clipId: c.id, patch: before as Operation extends never ? never : Partial<Clip> };
    }
    case "track.setState": {
      const t = trackById(doc, op.trackId);
      const before: Record<string, unknown> = {};
      for (const key of Object.keys(op.patch) as (keyof typeof op.patch)[]) {
        before[key] = t[key];
        (t as unknown as Record<string, unknown>)[key] = op.patch[key];
      }
      return { op: "track.setState", trackId: t.id, patch: before };
    }
    case "asset.add": {
      doc.assets.push(clone(op.asset));
      // assets não são removíveis por inversa simples (clips podem referenciar);
      // a inversa é no-op seguro — o asset órfão é ignorado pelo compilador
      return { op: "doc.setMeta", patch: {} };
    }
    case "doc.setMeta": {
      const before: Partial<TimelineDoc["meta"]> = {};
      for (const key of Object.keys(op.patch) as (keyof TimelineDoc["meta"])[]) {
        (before as Record<string, unknown>)[key] = clone(doc.meta[key]);
        (doc.meta as Record<string, unknown>)[key] = op.patch[key];
      }
      return { op: "doc.setMeta", patch: before };
    }
    case "clip.restore": {
      const removed: Clip[] = [];
      for (const id of op.removeIds) {
        const c = doc.clips.find((x) => x.id === id);
        if (c) removed.push(clone(c));
      }
      doc.clips = doc.clips.filter((x) => !op.removeIds.includes(x.id));
      doc.clips.push(...op.addClips.map(clone));
      return { op: "clip.restore", removeIds: op.addClips.map((c) => c.id), addClips: removed };
    }
  }
}

// ============ Transaction: aplica tudo-ou-nada, com inversa completa ============
export function applyTransaction(
  doc: TimelineDoc,
  ops: Operation[],
  source: Transaction["source"],
  label: string,
  opts: { validate?: boolean } = {}
): ApplyResult {
  const next = clone(doc);
  const inverses: Operation[] = [];
  for (const op of ops) {
    // clips em faixas bloqueadas são invioláveis (inclusive pela IA)
    if ("clipId" in op) {
      const c = next.clips.find((x) => x.id === (op as { clipId: string }).clipId);
      if (c && trackById(next, c.trackId).locked) {
        throw new TimelineError(`Faixa bloqueada — destrave para editar (clip ${c.id}).`);
      }
    }
    inverses.unshift(applyOp(next, op)); // inversas em ordem reversa
  }
  // Em faixas magnéticas (vídeo), uma edição pode criar sobreposição TEMPORÁRIA
  // que o ripple (refreshDerivedTracks) resolve logo em seguida. Nesses casos o
  // chamador passa validate:false e valida o estado FINAL, já rippado.
  if (opts.validate !== false) validateDoc(next);
  recomputeDuration(next);
  next.version = doc.version + 1;
  const tx: Transaction = {
    id: `tx_${newId()}`,
    source,
    label,
    ops,
    inverse: inverses,
    at: new Date().toISOString(),
  };
  return { doc: next, tx };
}

export function undoTransaction(doc: TimelineDoc, tx: Transaction): TimelineDoc {
  const { doc: next } = applyTransaction(doc, tx.inverse, "system", `Desfazer: ${tx.label}`);
  return next;
}
