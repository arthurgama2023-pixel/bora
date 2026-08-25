import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { listPaymentProofs } from "@/server/services/payment-proofs";

// Lista os comprovantes de PIX recebidos no WhatsApp (aba Verificação).
export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return listPaymentProofs(session.companyId);
  });
}
