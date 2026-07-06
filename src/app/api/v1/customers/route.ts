import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { customerSchema } from "@/lib/validation";
import { createCustomer, listCustomers } from "@/server/services/customers";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const sp = request.nextUrl.searchParams;
    return listCustomers(session.companyId, {
      q: sp.get("q") ?? undefined,
      status: sp.get("status") ?? undefined,
      type: sp.get("type") ?? undefined,
    });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const data = customerSchema.parse(await request.json());
    return createCustomer(session, data);
  });
}
