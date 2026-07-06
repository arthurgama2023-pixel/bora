import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    return session;
  });
}
