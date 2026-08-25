import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Verificacao } from "./verificacao";

export const metadata = { title: "Verificação de Comprovantes" };
export const dynamic = "force-dynamic";

export default async function VerificacaoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "MANAGER") redirect("/dashboard");

  return <Verificacao />;
}
