import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getCustomersStock } from "@/server/services/stock";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    return getCustomersStock(session.companyId);
  });
}
