import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Conversas } from "./conversas";

export const metadata = { title: "Conversas do Agente" };
export const dynamic = "force-dynamic";

export default async function ConversasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "MANAGER") redirect("/dashboard");

  return <Conversas />;
}
