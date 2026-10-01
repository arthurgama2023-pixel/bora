import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import {
  addInstance,
  listInstances,
  removeInstanceFromList,
  renameInstance,
} from "@/server/services/whatsapp/config";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";

// Lista os números (instâncias) ligados ao agente desta empresa.
export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return { instances: await listInstances(session.companyId) };
  });
}

// Adiciona um 2º (3º…) número: cria a instância na lista. O pareamento (QR/código)
// é feito depois pelo botão Conectar, já apontando para essa instância.
const addSchema = z.object({ label: z.string().max(60).optional() });
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { label } = addSchema.parse(await request.json().catch(() => ({})));
    const instance = await addInstance(session.companyId, label);
    return { instance };
  });
}

// Renomeia o rótulo de um número adicional.
const patchSchema = z.object({ name: z.string().min(1).max(100), label: z.string().max(60) });
export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { name, label } = patchSchema.parse(await request.json());
    await renameInstance(session.companyId, name, label);
    return { ok: true };
  });
}

// Remove um número adicional: desconecta/zera a instância no Evolution e tira da
// lista. A instância primária nunca é removida por aqui.
const delSchema = z.object({ name: z.string().min(1).max(100) });
export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { name } = delSchema.parse(await request.json());
    // Limpa a instância no servidor Evolution antes de esquecer o nome (best-effort).
    await getWhatsAppChannel().reset(session.companyId, name).catch(() => {});
    await removeInstanceFromList(session.companyId, name);
    return { ok: true };
  });
}
