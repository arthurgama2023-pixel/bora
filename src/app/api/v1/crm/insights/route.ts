import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getCrmSummary } from "@/server/services/crm";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return getCrmSummary(session.companyId);
  });
}
