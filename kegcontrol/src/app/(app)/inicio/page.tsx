import { redirect } from "next/navigation";

// "Início" e "Dashboard" foram unificados numa tela só (em /dashboard): a home
// agora tem saudação + KPIs + atalhos rápidos + atividade recente. Esta rota fica
// só como atalho/compatibilidade e manda pra home unificada.
export default function InicioPage() {
  redirect("/dashboard");
}
