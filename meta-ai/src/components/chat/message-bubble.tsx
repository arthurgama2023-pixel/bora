"use client";

import { Sparkles, Wrench } from "lucide-react";
import { Markdown } from "@/lib/markdown";
import type { DbMessage } from "@/lib/db";
import { ActionCard } from "./action-card";

export type ChatMessage = Omit<DbMessage, "createdAt"> & { createdAt: string | Date };

export function MessageBubble({
  message,
  onConfirm,
  onCancel,
  actionBusy,
}: {
  message: ChatMessage;
  onConfirm: (messageId: string) => void;
  onCancel: (messageId: string) => void;
  actionBusy: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in-up">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 max-w-[85%]">
        {message.toolEvents?.length ? (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {message.toolEvents.map((event, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Wrench className="size-3" />
                {event.label ?? event.tool}
              </span>
            ))}
          </div>
        ) : null}
        <Markdown content={message.content} />
        {message.pendingAction ? (
          <ActionCard
            action={message.pendingAction}
            onConfirm={() => onConfirm(message.id)}
            onCancel={() => onCancel(message.id)}
            busy={actionBusy}
          />
        ) : null}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in-up">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
        <Sparkles className="size-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
        <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}
