import { redirect } from "next/navigation";

// A raiz sempre redireciona: o proxy manda para /login sem sessão,
// e usuários autenticados caem direto no chat.
export default function Home() {
  redirect("/chat");
}
