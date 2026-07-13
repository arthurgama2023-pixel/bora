"use client";
import Link from "next/link";
import { useState } from "react";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [devLink, setDevLink] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setDevLink("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      setMsg(json.message || "Se este e-mail tiver conta, enviamos um link.");
      if (json.devResetLink) setDevLink(json.devResetLink);
    } catch {
      setMsg("Sem conexão com o servidor. Tente de novo.");
    }
    setBusy(false);
  }

  return (
    <main className="auth-main">
      <div className="auth-card">
        <div className="brand-mark auth-logo">🎬</div>
        <h2 className="auth-title">Esqueci a senha</h2>
        <p className="auth-sub">Enviaremos um link para redefinir sua senha.</p>
        <form onSubmit={submit} className="auth-form">
          <label className="auth-label">
            E-mail
            <input
              type="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="auth-input"
            />
          </label>
          {msg && <div className="auth-note">{msg}</div>}
          {devLink && (
            <div className="auth-note">
              Link de teste (dev):{" "}
              <a href={devLink} className="grad-text">
                redefinir agora
              </a>
            </div>
          )}
          <button type="submit" className="btn-primary auth-submit" disabled={busy}>
            {busy ? "Enviando…" : "Enviar link"}
          </button>
        </form>
        <div className="auth-links">
          <Link href="/login">Voltar para entrar</Link>
        </div>
      </div>
    </main>
  );
}
