import { redirect } from "next/navigation";

// A aba "Movimentações" abre direto no formulário de nova movimentação —
// é o que o usuário faz na maioria das vezes. O histórico/lista completa
// mora em /movimentacoes/historico (link "Ver histórico" na própria página).
export default function MovementsRootPage() {
  redirect("/movimentacoes/nova");
}
