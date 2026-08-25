import { prisma } from "@/lib/prisma";
import { phoneMatchKey } from "@/lib/phone";

// Comprovante de pagamento (foto) recebido no WhatsApp. O agente NUNCA tenta
// ler/validar — isso é sempre revisão humana, na aba Verificação. Guardado
// direto no banco (MVP, sem storage externo — ver PaymentProof no schema).

export async function savePaymentProof(
  companyId: string,
  input: { phone: string; pushName?: string; mimetype: string; base64: string; caption?: string },
) {
  return prisma.paymentProof.create({
    data: {
      companyId,
      phone: input.phone,
      pushName: input.pushName,
      mimetype: input.mimetype,
      imageData: Buffer.from(input.base64, "base64"),
      caption: input.caption,
    },
    select: { id: true },
  });
}

export type PaymentProofListItem = {
  id: string;
  phone: string;
  pushName: string | null;
  caption: string | null;
  createdAt: Date;
  // Pedido PENDING do site que bate com o mesmo telefone, se houver — pra
  // quem revisa saber a QUAL pedido o comprovante provavelmente se refere.
  // Só informativo: nada aqui muda o status do pedido sozinho.
  matchingOrder: { id: string; total: number; customerName: string } | null;
};

// Lista os comprovantes mais recentes pra revisão (sem os bytes da imagem —
// a tela pede a imagem individualmente via /api/v1/payment-proofs/[id]/image).
export async function listPaymentProofs(companyId: string, limit = 50): Promise<PaymentProofListItem[]> {
  const proofs = await prisma.paymentProof.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, phone: true, pushName: true, caption: true, createdAt: true },
  });
  if (proofs.length === 0) return [];

  // Pedidos PENDING da empresa, casados por telefone normalizado — evita uma
  // query por comprovante.
  const pendingOrders = await prisma.siteOrder.findMany({
    where: { companyId, status: "PENDING" },
    select: { id: true, phone: true, total: true, customerName: true },
  });
  const orderByKey = new Map(
    pendingOrders.map((o) => [phoneMatchKey(o.phone), o] as const).filter(([key]) => key !== null),
  );

  return proofs.map((p) => {
    const key = phoneMatchKey(p.phone);
    const order = key ? orderByKey.get(key) : undefined;
    return {
      ...p,
      matchingOrder: order ? { id: order.id, total: order.total, customerName: order.customerName } : null,
    };
  });
}

export async function getPaymentProofImage(
  companyId: string,
  id: string,
): Promise<{ imageData: Buffer; mimetype: string } | null> {
  const proof = await prisma.paymentProof.findFirst({
    where: { id, companyId },
    select: { imageData: true, mimetype: true },
  });
  if (!proof) return null;
  return { imageData: Buffer.from(proof.imageData), mimetype: proof.mimetype };
}
