"use client";

import { CheckCircle2, Loader2, Lock, Plus, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Status {
  configured: boolean;
  state: "open" | "connecting" | "close" | "unknown";
  qrBase64?: string;
  pairingCode?: string;
  number?: string;
  webhookUrl?: string;
  publicUrlWarning?: boolean;
}

async function apiGet(url: string) {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  return json?.ok ? json.data : null;
}

async function apiPost(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => null);
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

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instance, setInstance] = useState(instanceName);

  // Cada número em sua própria caixinha. Guardamos como lista; o backend recebe
  // uma string separada por vírgula (compatível com o que já existia).
  const [allowedList, setAllowedList] = useState<string[]>([""]);
  const [savingAllowed, setSavingAllowed] = useState(false);
  const [allowedSaved, setAllowedSaved] = useState(false);

  useEffect(() => {
    apiGet("/api/v1/whatsapp/allowed").then((d) => {
      if (!d) return;
      const list = String(d.allowedNumbers ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setAllowedList(list.length ? list : [""]);
    });
  }, []);

  function updateNumber(idx: number, value: string) {
    setAllowedList((prev) => prev.map((n, i) => (i === idx ? value : n)));
  }
  function addNumber() {
    setAllowedList((prev) => [...prev, ""]);
  }
  function removeNumber(idx: number) {
    setAllowedList((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [""];
    });
  }

  const refresh = useCallback(async () => {
    const data = (await apiGet("/api/v1/whatsapp/status")) as Status | null;
    if (!data) return null;
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
      const json = await apiPost("/api/v1/whatsapp/config", { apiUrl, apiKey, instance });
      if (json?.ok) {
        setConfigured(true);
        setEditingServer(false);
        setApiKey("");
        await refresh();
      }
    } finally {
      setSavingServer(false);
    }
  }

  async function saveAllowed(e: React.FormEvent) {
    e.preventDefault();
    setSavingAllowed(true);
    setAllowedSaved(false);
    try {
      const allowedNumbers = allowedList
        .map((n) => n.trim())
        .filter(Boolean)
        .join(",");
      const json = await apiPost("/api/v1/whatsapp/allowed", { allowedNumbers });
      if (json?.ok) {
        setAllowedSaved(true);
        setTimeout(() => setAllowedSaved(false), 2500);
      }
    } finally {
      setSavingAllowed(false);
    }
  }

  async function connect() {
    if (mode === "code" && phone.replace(/\D/g, "").length < 10) return;
    setConnecting(true);
    setStatus((s) => ({ ...(s as Status), pairingCode: undefined, qrBase64: undefined }));
    try {
      const json = await apiPost(
        "/api/v1/whatsapp/connect",
        mode === "code" ? { number: phone } : {},
      );
      if (json?.ok) {
        setStatus(json.data as Status);
        if (json.data.state !== "open" && !pollRef.current) {
          pollRef.current = setInterval(refresh, 3000);
        }
      }
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await apiPost("/api/v1/whatsapp/disconnect");
    setStatus((s) => ({
      ...(s as Status),
      state: "close",
      number: undefined,
      pairingCode: undefined,
      qrBase64: undefined,
    }));
    await refresh();
  }

  const connected = status?.state === "open";
  const step = (done: boolean, n: number) => (
    <span
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
        done ? "bg-success/15 text-success" : "bg-brand text-brand-foreground",
      )}
    >
      {done ? "✓" : n}
    </span>
  );

  return (
    <div className="max-w-2xl space-y-4">
      {/* Passo 1 — servidor Evolution */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          {step(configured && !editingServer, 1)}
          <h2 className="text-sm font-semibold">Servidor Evolution API</h2>
        </div>

        {configured && !editingServer ? (
          <p className="text-sm text-muted-foreground">
            Servidor conectado. Instância:{" "}
            <span className="font-medium text-foreground">{instanceName}</span>.{" "}
            <button
              onClick={() => setEditingServer(true)}
              className="text-brand-strong hover:underline"
            >
              trocar
            </button>
          </p>
        ) : (
          <form onSubmit={saveServer} className="space-y-3">
            <Field label="URL do servidor">
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://sua-evolution.exemplo.com"
                required
              />
            </Field>
            <Field label="API Key (global)">
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                placeholder="chave da Evolution"
                required
              />
            </Field>
            <Field label="Nome da instância">
              <Input
                value={instance}
                onChange={(e) => setInstance(e.target.value)}
                placeholder="kegcontrol"
              />
            </Field>
            <Button type="submit" disabled={savingServer}>
              {savingServer ? "Salvando…" : "Salvar servidor"}
            </Button>
          </form>
        )}
      </Card>

      {/* Passo 2 — conectar o número do agente */}
      {configured && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            {step(connected, 2)}
            <h2 className="text-sm font-semibold">Conectar o número do agente</h2>
          </div>

          {connected ? (
            <div className="rounded-xl bg-success/10 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
              <p className="mt-2 text-sm font-medium text-success">
                WhatsApp conectado{status?.number ? ` — +${status.number}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                O agente já responde e consulta barris, estoque e clientes nesse número.
              </p>
              <Button variant="outline" size="sm" onClick={disconnect} className="mt-3">
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {mode === "code" && status?.pairingCode ? (
                <div className="rounded-xl border border-brand/40 bg-brand/5 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-strong">
                    Código de confirmação
                  </p>
                  <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-foreground">
                    {status.pairingCode}
                  </p>
                  <div className="mt-3 text-left text-xs text-muted-foreground">
                    No celular do número <strong className="text-foreground">{phone}</strong>:
                    <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                      <li>
                        WhatsApp → <strong>Aparelhos conectados</strong>
                      </li>
                      <li>
                        <strong>Conectar um aparelho</strong> →{" "}
                        <strong>Conectar com número de telefone</strong>
                      </li>
                      <li>Digite o código acima</li>
                    </ol>
                  </div>
                  <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação… (atualiza sozinho)
                  </p>
                </div>
              ) : mode === "qr" && status?.qrBase64 ? (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={status.qrBase64}
                    alt="QR code do WhatsApp"
                    className="h-56 w-56 rounded-lg border border-border bg-white p-1"
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    WhatsApp → <span className="font-medium">Aparelhos conectados</span> → escaneie.
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Aguardando leitura…
                  </p>
                </div>
              ) : (
                mode === "code" && (
                  <Field label="Número do WhatsApp do agente (com DDD)">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-8888"
                      inputMode="tel"
                    />
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      É o número que será o assistente — os clientes mandam mensagem para ele.
                    </span>
                  </Field>
                )
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={connect}
                  disabled={connecting || (mode === "code" && phone.replace(/\D/g, "").length < 10)}
                >
                  {connecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Gerando…
                    </>
                  ) : status?.pairingCode || status?.qrBase64 ? (
                    "Gerar novo"
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4" />
                      {mode === "code" ? "Conectar WhatsApp" : "Gerar QR code"}
                    </>
                  )}
                </Button>
                <button
                  onClick={() => {
                    setMode(mode === "code" ? "qr" : "code");
                    setStatus((s) => ({ ...(s as Status), pairingCode: undefined, qrBase64: undefined }));
                  }}
                  className="text-xs font-medium text-brand-strong hover:underline"
                >
                  {mode === "code" ? "prefiro escanear QR code" : "prefiro código de confirmação"}
                </button>
              </div>

              {status?.publicUrlWarning && (
                <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  ⚠️ O app está em <span className="font-mono">localhost</span>. A conexão funciona, mas
                  para o agente <strong>receber</strong> mensagens o servidor precisa alcançar uma URL
                  pública — use um túnel (ngrok/cloudflared) ou faça o deploy.
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Quem o agente atende (allowlist) */}
      {configured && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-brand-strong" />
            <h2 className="text-sm font-semibold">Quem o agente atende</h2>
          </div>
          <form onSubmit={saveAllowed} className="space-y-3">
            <div className="space-y-2">
              {allowedList.map((num, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={num}
                    onChange={(e) => updateNumber(idx, e.target.value)}
                    placeholder="21980828309"
                    inputMode="tel"
                    className="max-w-xs"
                  />
                  {(allowedList.length > 1 || num.trim() !== "") && (
                    <button
                      type="button"
                      onClick={() => removeNumber(idx)}
                      title="Remover número"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addNumber}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Outro número
            </button>

            <p className="text-[11px] text-muted-foreground">
              O agente só responde a estes números. Deixe <strong>todos vazios</strong> para
              atender qualquer um. Com ou sem o 55 na frente — tanto faz.
            </p>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={savingAllowed}>
                {savingAllowed ? "Salvando…" : "Salvar"}
              </Button>
              {allowedSaved && <span className="text-xs font-medium text-success">✓ Salvo</span>}
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
