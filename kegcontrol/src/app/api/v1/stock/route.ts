import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getStockSummary } from "@/server/services/stock";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    return getStockSummary(session.companyId);
  });
}
