"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Olá! Sou seu assistente de agenda. Pode falar naturalmente:\n• “Marca reunião com João amanhã às 14h”\n• “Tenho algum compromisso hoje?”\n• “Cancela meu dentista”\n• “Quanto tempo livre tenho amanhã?”",
};

/** Renderização leve: **negrito** e quebras de linha. */
function renderContent(text: string) {
  return text.split("\n").map((line, i) => (
    <p key={i} className="min-h-[1em]">
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={j}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </p>
  ));
}

export function Chat({ sttAvailable }: { sttAvailable: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await res.json()) as { reply?: string; agendaChanged?: boolean };
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "Algo deu errado. Tente novamente." },
      ]);
      if (data.agendaChanged) window.dispatchEvent(new Event("agenda:refresh"));
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Não consegui falar com o servidor. Verifique a conexão." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!sttAvailable) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "A transcrição de voz requer a chave GROQ_API_KEY no servidor. Por enquanto, digite sua mensagem. 🙂",
        },
      ]);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setBusy(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "audio.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = (await res.json()) as { text?: string; message?: string };
          setBusy(false);
          if (data.text) await send(data.text);
          else
            setMessages((m) => [
              ...m,
              { role: "assistant", content: data.message ?? "Não consegui transcrever o áudio." },
            ]);
        } catch {
          setBusy(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Preciso de permissão do microfone para gravar áudio." },
      ]);
    }
  }

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold">Assistente</h2>
        <p className="text-xs text-zinc-400">Texto ou voz — linguagem natural</p>
      </div>

      <div ref={scrollRef} className="chat-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-zinc-900 text-white"
                  : "rounded-bl-md bg-zinc-100 text-zinc-800"
              }`}
            >
              {renderContent(m.content)}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-zinc-100 px-4 py-3"
      >
        <button
          type="button"
          onClick={toggleRecording}
          aria-label={recording ? "Parar gravação" : "Gravar áudio"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
            recording
              ? "animate-pulse bg-red-500 text-white"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden>
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={recording ? "Gravando… clique no microfone para enviar" : "Ex.: marca reunião com João amanhã às 14h"}
          disabled={busy || recording}
          className="h-10 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none transition focus:border-zinc-400 focus:bg-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:opacity-40"
          aria-label="Enviar"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M3.4 20.4 20.85 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87l.01 6.53Z" />
          </svg>
        </button>
      </form>
    </section>
  );
}
