"use client";
import Link from "next/link";
import { useState } from "react";

type Mode = "login" | "register";

export default function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [needInvite, setNeedInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, invite }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.inviteRequired) setNeedInvite(true);
        setError(json.error || "Não foi possível continuar. Tente de novo.");
        setBusy(false);
        return;
      }
      // Sessão criada — vai para a home (recarrega server components com o usuário).
      window.location.href = "/";
    } catch {
      setError("Sem conexão com o servidor. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="brand-mark auth-logo">🎬</div>
      <h2 className="auth-title">
        {isLogin ? "Entrar no " : "Criar conta no "}
        <span className="grad-text">Viral Studio</span>
      </h2>
      <p className="auth-sub">
        {isLogin ? "Bem-vindo de volta. Seus cortes te esperam." : "Comece a transformar seus vídeos em cortes virais."}
      </p>

      <form onSubmit={submit} className="auth-form">
        <label className="auth-label">
          E-mail
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="auth-input"
          />
        </label>
        <label className="auth-label">
          Senha
          <input
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isLogin ? "sua senha" : "mínimo 8 caracteres"}
            className="auth-input"
          />
        </label>

        {!isLogin && needInvite && (
          <label className="auth-label">
            Código de convite
            <input
              type="text"
              required
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="código do beta fechado"
              className="auth-input"
            />
          </label>
        )}

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="btn-primary auth-submit" disabled={busy}>
          {busy ? "Aguarde…" : isLogin ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <div className="auth-links">
        {isLogin ? (
          <>
            <Link href="/register">Criar conta</Link>
            <Link href="/forgot">Esqueci a senha</Link>
          </>
        ) : (
          <Link href="/login">Já tenho conta — entrar</Link>
        )}
      </div>
    </div>
  );
}
