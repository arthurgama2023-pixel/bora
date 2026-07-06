"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Status {
  configured: boolean;
  state: "open" | "connecting" | "close" | "unknown";
  qrBase64?: string;
  pairingCode?: string;
  number?: string;
  webhookUrl?: string;
  publicUrlWarning?: boolean;
}

export function ConnectWhatsApp({
  serverConfigured,
  instanceName,
}: {
  serverConfigured: boolean;
  instanceName: string;
}) {
  const [configured, setConfigured] = useState(serverConfigured);
  const [editingServer, setEditingServer] = useState(!serverConfigured);
  const [status, setStatus] = useState<Status | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [savingServer, setSavingServer] = useState(false);
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"code" | "qr">("code");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // formulário do servidor Evolution
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instance, setInstance] = useState(instanceName);

  // allowlist (quem o agente atende)
  const [allowedNumbers, setAllowedNumbers] = useState("");
  const [savingAllowed, setSavingAllowed] = useState(false);
  const [allowedSaved, setAllowedSaved] = useState(false);

  useEffect(() => {
    fetch("/api/whatsapp/allowed")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAllowedNumbers(d.allowedNumbers ?? ""))
      .catch(() => {});
  }, []);

  async function saveAllowed(e: React.FormEvent) {
    e.preventDefault();
    setSavingAllowed(true);
    setAllowedSaved(false);
    try {
      const res = await fetch("/api/whatsapp/allowed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowedNumbers }),
      });
      if (res.ok) {
        setAllowedSaved(true);
        setTimeout(() => setAllowedSaved(false), 2500);
      }
    } finally {
      setSavingAllowed(false);
    }
  }

  const refresh = useCallback(async () => {
    const res = await fetch("/api/whatsapp/status");
    if (!res.ok) return null;
    const data = (await res.json()) as Status;
    setStatus((prev) => ({ ...prev, ...data })); // preserva qr/pairingCode entre polls
    setConfigured(data.configured);
    if (data.state === "open" && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return data;
  }, []);

  useEffect(() => {
    if (configured) refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [configured, refresh]);

  async function saveServer(e: React.FormEvent) {
    e.preventDefault();
    setSavingServer(true);
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiUrl, apiKey, instance }),
      });
      if (res.ok) {
        setConfigured(true);
        setEditingServer(false);
        setApiKey("");
        await refresh();
      }
    } finally {
      setSavingServer(false);
    }
  }

  async function connect() {
    if (mode === "code" && phone.replace(/\D/g, "").length < 10) return;
    setConnecting(true);
    setStatus((s) => ({ ...(s as Status), pairingCode: undefined, qrBase64: undefined }));
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "code" ? { number: phone } : {}),
      });
      if (res.ok) {
        const data = (await res.json()) as Status;
        setStatus(data);
        if (data.state !== "open" && !pollRef.current) {
          pollRef.current = setInterval(refresh, 3000);
        }
      }
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await fetch("/api/whatsapp/disconnect", { method: "POST" });
    setStatus((s) => ({ ...(s as Status), state: "close", number: undefined, pairingCode: undefined, qrBase64: undefined }));
    await refresh();
  }

  const connected = status?.state === "open";

  return (
    <div className="space-y-4">
      {/* Passo 1 — servidor Evolution (pré-configurado via .env) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${configured && !editingServer ? "bg-emerald-100 text-emerald-700" : "bg-zinc-900 text-white"}`}>
            {configured && !editingServer ? "✓" : "1"}
          </span>
          <h2 className="text-sm font-semibold">Servidor Evolution API</h2>
        </div>

        {configured && !editingServer ? (
          <p className="text-sm text-zinc-500">
            Servidor conectado. Instância: <span className="font-medium text-zinc-700">{instanceName}</span>.{" "}
            <button onClick={() => setEditingServer(true)} className="text-indigo-600 hover:underline">
              trocar
            </button>
          </p>
        ) : (
          <form onSubmit={saveServer} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">URL do servidor</span>
              <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://sua-evolution.exemplo.com" required
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">API Key (global)</span>
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="chave da Evolution" required
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Nome da instância</span>
              <input value={instance} onChange={(e) => setInstance(e.target.value)} placeholder="agenda-ai"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white" />
            </label>
            <button type="submit" disabled={savingServer}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60">
              {savingServer ? "Salvando…" : "Salvar servidor"}
            </button>
          </form>
        )}
      </section>

      {/* Passo 2 — conectar o número do agente */}
      {configured && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${connected ? "bg-emerald-100 text-emerald-700" : "bg-zinc-900 text-white"}`}>
              {connected ? "✓" : "2"}
            </span>
            <h2 className="text-sm font-semibold">Conectar o número do agente</h2>
          </div>

          {connected ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <p className="text-2xl">🎉</p>
              <p className="mt-1 text-sm font-medium text-emerald-800">
                WhatsApp conectado{status?.number ? ` — +${status.number}` : ""}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                O agente já responde e agenda por mensagens nesse número.
              </p>
              <button onClick={disconnect}
                className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                Desconectar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* código de pareamento gerado */}
              {mode === "code" && status?.pairingCode ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Código de confirmação</p>
                  <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-indigo-700">
                    {status.pairingCode}
                  </p>
                  <div className="mt-3 text-left text-xs text-zinc-600">
                    No celular do número <strong>{phone}</strong>:
                    <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                      <li>WhatsApp → <strong>Aparelhos conectados</strong></li>
                      <li><strong>Conectar um aparelho</strong> → <strong>Conectar com número de telefone</strong></li>
                      <li>Digite o código acima</li>
                    </ol>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">Aguardando confirmação… (atualiza sozinho)</p>
                </div>
              ) : mode === "qr" && status?.qrBase64 ? (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={status.qrBase64} alt="QR code do WhatsApp" className="h-56 w-56 rounded-lg border border-zinc-100" />
                  <p className="text-center text-xs text-zinc-500">
                    WhatsApp → <span className="font-medium">Aparelhos conectados</span> → escaneie.
                  </p>
                  <p className="text-[11px] text-zinc-400">Aguardando leitura… (atualiza sozinho)</p>
                </div>
              ) : (
                <>
                  {mode === "code" && (
                    <label className="block">
                      <span className="text-xs font-medium text-zinc-600">
                        Número do WhatsApp do agente (com DDD)
                      </span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-8888"
                        inputMode="tel"
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white"
                      />
                      <span className="mt-1 block text-[11px] text-zinc-400">
                        É o número que será o assistente — os clientes mandam mensagem para ele.
                      </span>
                    </label>
                  )}
                  {mode === "qr" && (
                    <p className="text-sm text-zinc-500">Gere um QR code para escanear com o celular.</p>
                  )}
                </>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={connect}
                  disabled={connecting || (mode === "code" && phone.replace(/\D/g, "").length < 10)}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
                >
                  {connecting
                    ? "Gerando…"
                    : status?.pairingCode || status?.qrBase64
                      ? "Gerar novo"
                      : mode === "code"
                        ? "Gerar código de conexão"
                        : "Gerar QR code"}
                </button>
                <button
                  onClick={() => {
                    setMode(mode === "code" ? "qr" : "code");
                    setStatus((s) => ({ ...(s as Status), pairingCode: undefined, qrBase64: undefined }));
                  }}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  {mode === "code" ? "prefiro escanear QR code" : "prefiro código de confirmação"}
                </button>
              </div>

              {status?.publicUrlWarning && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  ⚠️ O app está em <span className="font-mono">localhost</span>. A conexão funciona, mas para o
                  agente <strong>receber</strong> mensagens o servidor precisa alcançar uma URL pública — use um
                  túnel (ngrok/cloudflared) ou faça o deploy no Render.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Quem o agente atende (allowlist) */}
      {configured && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-sm">🔒</span>
            <h2 className="text-sm font-semibold">Quem o agente atende</h2>
          </div>
          <form onSubmit={saveAllowed} className="space-y-2">
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Números permitidos</span>
              <input
                value={allowedNumbers}
                onChange={(e) => setAllowedNumbers(e.target.value)}
                placeholder="21980828309  (vários: separe por vírgula)"
                inputMode="tel"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white"
              />
              <span className="mt-1 block text-[11px] text-zinc-400">
                O agente só responde a estes números. Deixe <strong>vazio</strong> para atender qualquer um.
                Com ou sem o 55 na frente — tanto faz.
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingAllowed}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60"
              >
                {savingAllowed ? "Salvando…" : "Salvar"}
              </button>
              {allowedSaved && <span className="text-xs font-medium text-emerald-600">✓ Salvo</span>}
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
