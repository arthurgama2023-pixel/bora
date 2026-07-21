import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PrecosSite } from "./precos-site";

export const metadata = { title: "Preços do Site" };
export const dynamic = "force-dynamic";

export default async function PrecosSitePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "MANAGER") redirect("/dashboard");

  return <PrecosSite />;
}
