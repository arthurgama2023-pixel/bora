"use client";

import { useCallback, useEffect, useState } from "react";

interface ApiEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
}

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "short" });

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function AgendaPanel() {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/events?days=7");
      if (res.ok) {
        const data = (await res.json()) as { events: ApiEvent[] };
        setEvents(data.events);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onRefresh = () => load();
    window.addEventListener("agenda:refresh", onRefresh);
    return () => window.removeEventListener("agenda:refresh", onRefresh);
  }, [load]);

  const todayKey = dayKey(new Date());
  const groups = new Map<string, ApiEvent[]>();
  for (const e of events) {
    const k = dayKey(new Date(e.start));
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const sortedDays = [...groups.keys()].sort();

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold">Próximos 7 dias</h2>
        <p className="text-xs text-zinc-400">
          {loading ? "Carregando…" : `${events.length} compromisso${events.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="chat-scroll flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {!loading && events.length === 0 && (
          <p className="pt-8 text-center text-sm text-zinc-400">
            Agenda livre. Peça no chat: <br />
            <span className="italic">“Marca reunião amanhã às 14h”</span>
          </p>
        )}

        {sortedDays.map((k) => {
          const date = new Date(`${k}T12:00:00`);
          const isToday = k === todayKey;
          return (
            <div key={k}>
              <p
                className={`mb-2 text-xs font-medium uppercase tracking-wide ${
                  isToday ? "text-indigo-600" : "text-zinc-400"
                }`}
              >
                {isToday ? "Hoje" : dayFmt.format(date)}
              </p>
              <div className="space-y-2">
                {groups.get(k)!.map((e) => (
                  <div
                    key={e.id}
                    className={`rounded-xl border px-3.5 py-2.5 ${
                      isToday ? "border-indigo-100 bg-indigo-50/50" : "border-zinc-100 bg-zinc-50/60"
                    }`}
                  >
                    <p className="text-sm font-medium leading-snug">{e.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {timeFmt.format(new Date(e.start))} – {timeFmt.format(new Date(e.end))}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
