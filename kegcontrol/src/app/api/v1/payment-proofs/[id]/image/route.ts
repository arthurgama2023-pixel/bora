import { NextResponse } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertRole, requireSession } from "@/lib/auth";
import { getPaymentProofImage } from "@/server/services/payment-proofs";

// Serve os BYTES da imagem (não passa pelo envelope handle() — resposta não é
// JSON). Autenticado: comprovante de PIX é documento privado do cliente,
// nunca público como a imagem da tabela de preços.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await params;
    const proof = await getPaymentProofImage(session.companyId, id);
    if (!proof) return NextResponse.json({ ok: false, error: "não encontrado" }, { status: 404 });

    return new NextResponse(new Uint8Array(proof.imageData), {
      headers: {
        "Content-Type": proof.mimetype,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: "erro interno" }, { status: 500 });
  }
}
