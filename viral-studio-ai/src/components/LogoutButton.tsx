"use client";
import { useState } from "react";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignora — vamos redirecionar de qualquer forma */
    }
    window.location.href = "/login";
  }
  return (
    <button onClick={logout} className="logout-btn" disabled={busy} aria-label="Sair da conta">
      {busy ? "Saindo…" : "Sair"}
    </button>
  );
}
