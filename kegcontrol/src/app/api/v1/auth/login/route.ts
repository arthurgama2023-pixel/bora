import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { createSessionCookie } from "@/lib/auth";
import type { Role } from "@/lib/enums";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/server/services/users";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const { email, password } = loginSchema.parse(await request.json());
    const user = await authenticate(email, password);
    await createSessionCookie({
      userId: user.id,
      companyId: user.companyId,
      role: user.role as Role,
      name: user.name,
      email: user.email,
    });
    return { id: user.id, name: user.name, role: user.role };
  });
}
