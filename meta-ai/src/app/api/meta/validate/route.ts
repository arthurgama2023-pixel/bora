// Valida um access token da Meta e devolve as contas de anúncio disponíveis,
// para o usuário escolher qual conectar. Não salva nada — só verifica.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { validateAccessToken } from "@/services/meta/oauth";
import { MetaApiError } from "@/services/meta/client";

const schema = z.object({ accessToken: z.string().min(20, "Token muito curto") });

export async function POST(request: Request) {
  await requireSession();
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  try {
    const { user, adAccounts } = await validateAccessToken(parsed.data.accessToken.trim());
    if (!adAccounts.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Token válido, mas sem contas de anúncio acessíveis. Confirme que o token tem a permissão ads_read e que o usuário administra alguma conta.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      user,
      adAccounts: adAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        active: a.account_status === 1,
      })),
    });
  } catch (error) {
    const message =
      error instanceof MetaApiError
        ? `A Meta recusou o token: ${error.message}`
        : "Não foi possível validar o token. Verifique e tente novamente.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
