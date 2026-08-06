import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PedidosSite } from "./pedidos-site";

export const metadata = { title: "Pedidos do Site" };
export const dynamic = "force-dynamic";

export default async function PedidosSitePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "MANAGER") redirect("/dashboard");

  return <PedidosSite />;
}
