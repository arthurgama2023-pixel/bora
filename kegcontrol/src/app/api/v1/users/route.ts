import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { userSchema } from "@/lib/validation";
import { createUser, listUsers } from "@/server/services/users";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN"]);
    return listUsers(session.companyId);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN"]);
    const data = userSchema.parse(await request.json());
    return createUser(session, data);
  });
}
