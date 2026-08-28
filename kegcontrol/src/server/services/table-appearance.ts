import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

// Aparência da tabela de preços (imagem que o agente manda no WhatsApp): o dono
// sobe uma IMAGEM DE FUNDO e um nível de escurecimento (pra os preços ficarem
// legíveis por cima). Guardado por empresa no model Setting (key/valor). Há um
// slot ATIVO (o que vale de verdade) e um RASCUNHO (a prévia antes de salvar),
// pra a nova aba "Aparência da tabela" mostrar como vai ficar sem já valer.

const KEYS = {
  bg: "table.bg", // data URI da imagem de fundo ativa
  bgDraft: "table.bg_draft", // data URI do rascunho (prévia)
  overlay: "table.overlay", // escurecimento ativo (0-85, %)
  overlayDraft: "table.overlay_draft", // escurecimento do rascunho
} as const;

const OVERLAY_DEFAULT = 55;
const MAX_DATA_URI = 3_400_000; // ~2.5MB — o cliente já reduz a imagem antes de subir

function clampOverlay(n: number | undefined | null): number {
  if (n == null || Number.isNaN(n)) return OVERLAY_DEFAULT;
  return Math.max(0, Math.min(85, Math.round(n)));
}

// Lê o escurecimento salvo (string do Setting) caindo no padrão quando ausente
// ou vazio — sem isso, `Number(null)` vira 0 e a tabela sairia sem escurecimento.
function overlayFrom(raw: string | null): number {
  if (raw == null || raw.trim() === "") return OVERLAY_DEFAULT;
  const n = Number(raw);
  return Number.isNaN(n) ? OVERLAY_DEFAULT : clampOverlay(n);
}

function assertImageDataUri(image: string) {
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(image)) {
    throw new ApiError(400, "Envie uma imagem válida (PNG, JPEG ou WebP).");
  }
  if (image.length > MAX_DATA_URI) {
    throw new ApiError(413, "Imagem grande demais. Tente uma menor (o painel já reduz automaticamente).");
  }
}

async function read(companyId: string, key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key } },
    select: { value: true },
  });
  return row?.value ?? null;
}

async function write(companyId: string, key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key } },
    update: { value },
    create: { companyId, key, value },
  });
}

async function remove(companyId: string, key: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { companyId, key } });
}

// Fundo efetivo pra montar a imagem: `preview` lê o RASCUNHO (cai no ativo se
// não houver rascunho); sem preview, lê só o ativo. image = null → tabela usa o
// fundo escuro padrão.
export async function getTableBackground(
  companyId: string,
  opts: { preview?: boolean } = {},
): Promise<{ image: string | null; overlay: number }> {
  if (opts.preview) {
    const draft = await read(companyId, KEYS.bgDraft);
    if (draft) {
      return { image: draft, overlay: overlayFrom(await read(companyId, KEYS.overlayDraft)) };
    }
  }
  const active = await read(companyId, KEYS.bg);
  return { image: active, overlay: overlayFrom(await read(companyId, KEYS.overlay)) };
}

// Estado pra UI: se tem imagem ativa/rascunho e o escurecimento a mostrar.
export async function getTableAppearanceState(companyId: string): Promise<{
  hasActive: boolean;
  hasDraft: boolean;
  overlay: number;
}> {
  const [active, draft, ovDraft, ov] = await Promise.all([
    read(companyId, KEYS.bg),
    read(companyId, KEYS.bgDraft),
    read(companyId, KEYS.overlayDraft),
    read(companyId, KEYS.overlay),
  ]);
  return {
    hasActive: !!active,
    hasDraft: !!draft,
    overlay: overlayFrom(ovDraft ?? ov),
  };
}

// Guarda a prévia (rascunho). image ausente = só atualiza o escurecimento.
export async function saveTableDraft(
  companyId: string,
  input: { image?: string; overlay?: number },
): Promise<void> {
  if (input.image !== undefined) {
    assertImageDataUri(input.image);
    await write(companyId, KEYS.bgDraft, input.image);
  }
  if (input.overlay !== undefined) {
    await write(companyId, KEYS.overlayDraft, String(clampOverlay(input.overlay)));
  }
}

// Confirma: o rascunho vira o fundo ATIVO (é o que o WhatsApp passa a usar).
export async function commitTableDraft(companyId: string): Promise<void> {
  const draft = await read(companyId, KEYS.bgDraft);
  if (!draft) throw new ApiError(400, "Não há prévia para salvar. Envie uma imagem primeiro.");
  await write(companyId, KEYS.bg, draft);
  await write(companyId, KEYS.overlay, String(overlayFrom(await read(companyId, KEYS.overlayDraft))));
}

// Remove a imagem (volta ao fundo escuro padrão) — apaga ativo e rascunho.
export async function resetTableBackground(companyId: string): Promise<void> {
  await Promise.all([
    remove(companyId, KEYS.bg),
    remove(companyId, KEYS.bgDraft),
    remove(companyId, KEYS.overlay),
    remove(companyId, KEYS.overlayDraft),
  ]);
}
