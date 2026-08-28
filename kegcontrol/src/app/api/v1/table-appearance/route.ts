import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import {
  commitTableDraft,
  getTableAppearanceState,
  resetTableBackground,
  saveTableDraft,
} from "@/server/services/table-appearance";

// Aparência da tabela de preços (fundo da imagem do WhatsApp): rascunho (prévia)
// → confirmar. A prévia é montada pela rota /api/tabela-precos?preview=1.
const bodySchema = z.object({
  action: z.enum(["draft", "commit", "reset"]),
  image: z.string().optional(), // data URI (só no action "draft")
  overlay: z.number().optional(), // 0-85 (%)
});

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return getTableAppearanceState(session.companyId);
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const body = bodySchema.parse(await request.json());
    if (body.action === "draft") {
      await saveTableDraft(session.companyId, { image: body.image, overlay: body.overlay });
    } else if (body.action === "commit") {
      await commitTableDraft(session.companyId);
    } else {
      await resetTableBackground(session.companyId);
    }
    return getTableAppearanceState(session.companyId);
  });
}
