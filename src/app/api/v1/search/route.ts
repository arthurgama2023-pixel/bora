import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { globalSearch } from "@/server/services/search";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const q = request.nextUrl.searchParams.get("q") ?? "";
    return globalSearch(session.companyId, q);
  });
}
