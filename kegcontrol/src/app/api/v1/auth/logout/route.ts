import { handle } from "@/lib/api";
import { destroySessionCookie } from "@/lib/auth";

export async function POST() {
  return handle(async () => {
    await destroySessionCookie();
    return { loggedOut: true };
  });
}
