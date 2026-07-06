import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { listDispatches } from "@/server/services/campaigns";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return listDispatches(session.companyId);
  });
}
