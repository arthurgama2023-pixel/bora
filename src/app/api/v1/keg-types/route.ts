import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { kegTypeSchema } from "@/lib/validation";
import { createKegType, listKegTypes } from "@/server/services/keg-types";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    return listKegTypes(session.companyId);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const data = kegTypeSchema.parse(await request.json());
    return createKegType(session, data);
  });
}
