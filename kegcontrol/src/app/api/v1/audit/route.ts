import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { listAudit } from "@/server/services/audit";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN"]);
    return listAudit(session.companyId);
  });
}
