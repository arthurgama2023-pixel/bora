import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export { processCompanyIncoming } from "./process";
export { runAttendant } from "./attendant";

/** Empresa do usuário logado (dono), ou null se não logado / sem empresa. */
export async function getSessionCompany() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return db.company.findUnique({
    where: { ownerUserId: userId },
    include: { services: { orderBy: { createdAt: "asc" } } },
  });
}
