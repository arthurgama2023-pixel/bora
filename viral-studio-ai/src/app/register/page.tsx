import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/");
  return (
    <main className="auth-main">
      <AuthForm mode="register" />
    </main>
  );
}
