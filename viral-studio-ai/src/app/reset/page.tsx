"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResetInner() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Não foi possível redefinir. Peça um novo link.");
        setBusy(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Sem conexão com o servidor. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="brand-mark auth-logo">🎬</div>
      <h2 className="auth-title">Nova senha</h2>
      <p className="auth-sub">Escolha uma senha nova para sua conta.</p>
      {!token ? (
        <div className="auth-error">Link inválido. Peça um novo em &quot;Esqueci a senha&quot;.</div>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label className="auth-label">
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
              className="auth-input"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn-primary auth-submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}
      <div className="auth-links">
        <Link href="/login">Voltar para entrar</Link>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <main className="auth-main">
      <Suspense fallback={<div className="auth-card">Carregando…</div>}>
        <ResetInner />
      </Suspense>
    </main>
  );
}
