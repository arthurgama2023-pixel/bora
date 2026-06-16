import { useState } from "react";
import { API, setToken } from "../api";
import "./Login.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao entrar.");
      setToken(data.token);
      onLogin(data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-bolt">⚡</span>
          <span className="login-name">Bora<span className="login-dot">.</span></span>
        </div>
        <p className="login-sub">Acesso restrito ao time CD Grupo</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">Usuário</label>
            <input
              className="login-input"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="login-field">
            <label className="login-label">Senha</label>
            <input
              className="login-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
