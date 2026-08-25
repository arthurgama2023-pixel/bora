"use client";

// Tela de conexão da Meta Ads — o coração do "ao clicar em conectar, peça o
// que for necessário". Três métodos, cada um pedindo exatamente o que precisa:
//   • Token de acesso  → cola token, valida na Meta real, escolhe a conta
//   • OAuth oficial     → um clique (se o servidor tem App ID/Secret)
//   • Conta demo        → sem nada, dados simulados
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  KeyRound,
  Loader2,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ValidatedAccount = { id: string; name: string; currency: string; active: boolean };
type Method = "token" | "oauth" | "demo";

const PERMISSIONS = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "instagram_basic",
];

export function ConnectMethods({ oauthConfigured }: { oauthConfigured: boolean }) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<Method>("token");

  // Estado do fluxo por token
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<ValidatedAccount[] | null>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [validatedUser, setValidatedUser] = useState<string | null>(null);

  const validate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json as { user: { name: string }; adAccounts: ValidatedAccount[] };
    },
    onSuccess: (data) => {
      setAccounts(data.adAccounts);
      setValidatedUser(data.user.name);
      setSelectedAccount(data.adAccounts.find((a) => a.active)?.id ?? data.adAccounts[0].id);
      toast.success(`Token válido — ${data.adAccounts.length} conta(s) encontrada(s)`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Token inválido"),
  });

  const connectToken = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "token", accessToken: token, adAccountId: selectedAccount }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      toast.success("Conta Meta conectada!");
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao conectar"),
  });

  const connectDemo = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "demo" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      toast.success("Conta demo conectada!");
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Erro ao conectar conta demo"),
  });

  const methods: Array<{ id: Method; label: string; icon: typeof KeyRound; hint: string }> = [
    { id: "token", label: "Token de acesso", icon: KeyRound, hint: "Rápido · recomendado" },
    { id: "oauth", label: "OAuth oficial", icon: PlugZap, hint: "Produção" },
    { id: "demo", label: "Conta demo", icon: FlaskConical, hint: "Sem credenciais" },
  ];

  return (
    <div className="mx-auto w-full max-w-xl animate-fade-in-up">
      <div className="mb-5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#1877F2]/10">
          <PlugZap className="size-6 text-[#1877F2]" />
        </div>
        <h1 className="mt-3 text-lg font-semibold tracking-tight">Conectar Meta Ads</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Escolha como quer conectar sua conta de anúncios. O agente só opera depois de
          conectado — e sempre com sua confirmação.
        </p>
      </div>

      {/* Seletor de método */}
      <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
        {methods.map((item) => (
          <button
            key={item.id}
            onClick={() => setMethod(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center transition-colors cursor-pointer",
              method === item.id
                ? "bg-card shadow-sm ring-1 ring-border"
                : "hover:bg-card/50",
            )}
          >
            <item.icon
              className={cn(
                "size-4",
                method === item.id ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span className="text-xs font-medium leading-tight">{item.label}</span>
            <span className="text-[10px] text-muted-foreground">{item.hint}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          {/* ── Método: Token de acesso ── */}
          {method === "token" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">O que você precisa:</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li>
                    Abrir o{" "}
                    <a
                      href="https://developers.facebook.com/tools/explorer/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      Graph API Explorer <ExternalLink className="size-3" />
                    </a>
                  </li>
                  <li>
                    Selecionar as permissões:{" "}
                    <span className="font-mono text-[11px] text-foreground">
                      {PERMISSIONS.join(", ")}
                    </span>
                  </li>
                  <li>Gerar o token e colar abaixo</li>
                </ol>
              </div>

              {!accounts ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="token">Token de acesso da Meta</Label>
                    <Textarea
                      id="token"
                      placeholder="EAAG... (cole o token do Graph API Explorer)"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="min-h-[80px] font-mono text-xs"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={token.trim().length < 20 || validate.isPending}
                    onClick={() => validate.mutate()}
                  >
                    {validate.isPending ? (
                      <>
                        <Loader2 className="animate-spin" /> Validando na Meta…
                      </>
                    ) : (
                      <>
                        Validar token <ArrowRight />
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
                    <CheckCircle2 className="size-4 text-success" />
                    <span>
                      Token válido{validatedUser ? ` · ${validatedUser}` : ""}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Escolha a conta de anúncios</Label>
                    <Select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} · {account.currency}
                          {account.active ? "" : " (inativa)"}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAccounts(null);
                        setValidatedUser(null);
                      }}
                    >
                      Voltar
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={connectToken.isPending}
                      onClick={() => connectToken.mutate()}
                    >
                      {connectToken.isPending ? (
                        <>
                          <Loader2 className="animate-spin" /> Conectando…
                        </>
                      ) : (
                        <>
                          <ShieldCheck /> Conectar conta
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Método: OAuth oficial ── */}
          {method === "oauth" && (
            <div className="space-y-4">
              {oauthConfigured ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    O servidor já está configurado. Clique para autorizar via login oficial da
                    Meta — você escolhe a conta e as permissões na tela da própria Meta.
                  </p>
                  <Button
                    className="w-full bg-[#1877F2] text-white hover:bg-[#1877F2]/90"
                    onClick={() => (window.location.href = "/api/meta/connect")}
                  >
                    <PlugZap /> Conectar com Meta (OAuth)
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
                    <p className="font-medium text-foreground">
                      OAuth ainda não configurado no servidor
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Para habilitar o login oficial da Meta, defina no <code>.env</code> e
                      reinicie o servidor:
                    </p>
                    <div className="mt-2 space-y-1 font-mono text-[11px] text-foreground">
                      <div>META_APP_ID=...</div>
                      <div>META_APP_SECRET=...</div>
                      <div>META_REDIRECT_URI=http://localhost:3030/api/meta/callback</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Crie o app em{" "}
                    <a
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      developers.facebook.com <ExternalLink className="size-3" />
                    </a>{" "}
                    (tipo Business), adicione os produtos <strong>Marketing API</strong> e{" "}
                    <strong>Facebook Login for Business</strong>, e whiteliste a Redirect URI.
                    Enquanto isso, use o método <strong>Token de acesso</strong> — funciona na
                    hora.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Método: Demo ── */}
          {method === "demo" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecta uma conta simulada (PowerTrade Solar) com 8 campanhas e métricas
                realistas de 30 dias. Ideal para explorar o agente, o wizard e a análise de
                criativos sem nenhuma credencial.
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={connectDemo.isPending}
                onClick={() => connectDemo.mutate()}
              >
                {connectDemo.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Conectando…
                  </>
                ) : (
                  <>
                    <FlaskConical /> Usar conta demo
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
