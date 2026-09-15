import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PedidosAgente } from "./pedidos-agente";

export const metadata = { title: "Pedidos do Agente" };
export const dynamic = "force-dynamic";

export default async function PedidosAgentePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "MANAGER") redirect("/dashboard");

  return <PedidosAgente />;
}
