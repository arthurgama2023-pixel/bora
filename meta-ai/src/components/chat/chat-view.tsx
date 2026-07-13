"use client";

// Tela principal do chat: histórico, envio de mensagens, ações rápidas e o
// fluxo de confirmação de ações do agente.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  BarChart3,
  Copy,
  Image as ImageIcon,
  PauseCircle,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble, TypingIndicator, type ChatMessage } from "./message-bubble";

type ChatResponse = {
  ok: boolean;
  error?: string;
  conversationId: string;
  messages: ChatMessage[];
};

const SUGGESTIONS = [
  { icon: BarChart3, text: "Analise minhas campanhas" },
  { icon: TrendingUp, text: "Quais campanhas possuem CPA alto?" },
  { icon: PauseCircle, text: "Pause campanhas com ROAS menor que 1" },
  { icon: Rocket, text: "Crie uma campanha para vender placas solares" },
];

const QUICK_ACTIONS: Array<
  { icon: typeof Rocket; label: string } & ({ message: string } | { href: string })
> = [
  { icon: Wand2, label: "Criar campanha", href: "/wizard" },
  { icon: Copy, label: "Duplicar campanha", message: "Duplique minha melhor campanha" },
  { icon: PauseCircle, label: "Pausar campanha", message: "Pause campanhas com ROAS menor que 1" },
  { icon: TrendingUp, label: "Escalar campanha", message: "Escale minha melhor campanha em 20%" },
  { icon: ImageIcon, label: "Analisar criativo", href: "/creatives" },
  { icon: Sparkles, label: "Gerar copy", message: "Gere 3 copies de anúncio para meu produto" },
  { icon: Users, label: "Criar público", message: "Crie um público semelhante" },
];

export function ChatView({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conversation", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<{ messages: ChatMessage[] }> => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return { messages: json.messages };
    },
  });

  const messages = data?.messages ?? [];

  const send = useMutation({
    mutationFn: async (message: string): Promise<ChatResponse> => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId ?? null, message }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao enviar mensagem");
      return json;
    },
    onMutate: (message) => setOptimistic(message),
    onSuccess: (response) => {
      queryClient.setQueryData(
        ["conversation", response.conversationId],
        (old: { messages: ChatMessage[] } | undefined) => ({
          messages: [...(old?.messages ?? []), ...response.messages],
        }),
      );
      setOptimistic(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (!conversationId) router.push(`/chat/${response.conversationId}`);
    },
    onError: (error) => {
      setOptimistic(null);
      toast.error(error instanceof Error ? error.message : "Erro ao enviar");
    },
  });

  const decide = useMutation({
    mutationFn: async (input: {
      messageId: string;
      decision: "confirm" | "cancel";
    }): Promise<ChatResponse> => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, ...input }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao processar ação");
      return json;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(
        ["conversation", conversationId],
        (old: { messages: ChatMessage[] } | undefined) => ({
          messages: [
            ...(old?.messages ?? []).map((m) =>
              m.id === variables.messageId && m.pendingAction
                ? {
                    ...m,
                    pendingAction: {
                      ...m.pendingAction,
                      status:
                        variables.decision === "confirm"
                          ? ("confirmed" as const)
                          : ("cancelled" as const),
                    },
                  }
                : m,
            ),
            ...response.messages,
          ],
        }),
      );
      // Mutação pode ter alterado campanhas/métricas — invalida tudo que exibe.
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      if (variables.decision === "confirm") toast.success("Ação executada");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro na ação"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, optimistic, send.isPending]);

  function submit(text?: string) {
    const message = (text ?? input).trim();
    if (!message || send.isPending) return;
    setInput("");
    send.mutate(message);
  }

  const isEmpty = !conversationId && !optimistic;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6">
          {isLoading && conversationId ? (
            <div className="space-y-4">
              <Skeleton className="ml-auto h-10 w-1/2" />
              <Skeleton className="h-24 w-3/4" />
              <Skeleton className="ml-auto h-10 w-1/3" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center pt-24 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" />
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">
                Como posso ajudar com seu tráfego hoje?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Peça análises, crie campanhas ou otimize o que já está rodando.
              </p>
              <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.text}
                    onClick={() => submit(suggestion.text)}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-all hover:border-primary/40 hover:bg-accent cursor-pointer"
                  >
                    <suggestion.icon className="size-4 shrink-0 text-primary" />
                    {suggestion.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onConfirm={(messageId) => decide.mutate({ messageId, decision: "confirm" })}
                  onCancel={(messageId) => decide.mutate({ messageId, decision: "cancel" })}
                  actionBusy={decide.isPending}
                />
              ))}
              {optimistic && (
                <div className="flex justify-end animate-fade-in-up">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {optimistic}
                  </div>
                </div>
              )}
              {(send.isPending || decide.isPending) && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Ações rápidas + input */}
      <div className="border-t border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-3">
          <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() =>
                  "href" in action ? router.push(action.href) : submit(action.message)
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground cursor-pointer"
              >
                <action.icon className="size-3" />
                {action.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Pergunte ou peça uma ação — ex.: 'Analise minhas campanhas'"
              rows={1}
              className="max-h-40 min-h-[38px] border-0 shadow-none focus-visible:ring-0 bg-transparent"
            />
            <Button
              size="icon"
              aria-label="Enviar"
              onClick={() => submit()}
              disabled={!input.trim() || send.isPending}
            >
              <ArrowUp />
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground/70">
            O agente nunca altera campanhas sem sua confirmação.
          </p>
        </div>
      </div>
    </div>
  );
}
