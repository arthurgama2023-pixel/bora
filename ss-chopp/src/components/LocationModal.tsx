"use client";

import { useMemo, useState, useEffect } from "react";
import { useLocation } from "@/lib/location-context";
import Countdown from "@/components/Countdown";

// Normaliza pra busca tolerante: tira acento/caixa, expande abreviações comuns
// (pq→parque, jd→jardim, vl→vila) e uniformiza escrita ("matheus"→"mateus").
// Assim "pq araruama", "são matheus" e "apollo11" acham o bairro certo.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bpq\b/g, "parque")
    .replace(/\bjd\b/g, "jardim")
    .replace(/\bvl\b/g, "vila")
    .replace(/th/g, "t")
    .replace(/\s+/g, " ")
    .trim();

// versão sem espaços — casa "apollo11" com "apollo 11", "lotexv" com "lote xv"
const nospace = (s: string) => norm(s).replace(/\s+/g, "");

// Modal de entrada em dois passos:
//  1) O cliente DIGITA o bairro; sugestões aparecem conforme ele escreve.
//  2) Depois que clica, REVELA a surpresa — desconto de hoje + frete grátis.
export default function LocationModal() {
  const { zones, zone, ready, setZone, phone, setPhone } = useLocation();
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [phoneInput, setPhoneInput] = useState(phone);

  // Quando o usuário clica "trocar", zone vira null e o modal reaparece.
  // Reseta tudo pra o passo 1 (o campo de digitar).
  useEffect(() => {
    if (!zone) {
      setRevealed(false);
      setQuery("");
      setPickedId("");
    }
  }, [zone]);

  // O telefone salvo é lido do localStorage DEPOIS do primeiro render (efeito
  // do context), então o campo começa vazio. Sincroniza quando ele chega —
  // sem isso, confirmar o modal sobrescreveria o telefone salvo com "".
  useEffect(() => {
    if (phone) setPhoneInput(phone);
  }, [phone]);

  const matches = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const qn = nospace(query);
    return zones.filter((z) => {
      const alvo = norm(`${z.name} ${z.city}`);
      return alvo.includes(q) || nospace(alvo).includes(qn);
    });
  }, [query, zones]);

  // bairro escolhido: ou clicou numa sugestão, ou só sobrou um resultado
  const resolvedId = pickedId || (matches.length === 1 ? matches[0].id : "");

  if (!ready) return null; // ainda lendo o localStorage — não pisca
  if (zone) return null; // já escolheu — segue o catálogo

  const chosen = resolvedId ? zones.find((z) => z.id === resolvedId) : undefined;

  function pick(id: string) {
    const z = zones.find((z) => z.id === id);
    if (!z) return;
    setPickedId(id);
    setQuery(`${z.name} · ${z.city}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {!revealed ? (
          <>
            <div className="text-center">
              <p className="text-4xl">📍</p>
              <h2 className="mt-2 text-xl font-extrabold text-brand-black">
                Qual é o seu bairro?
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Digite o seu bairro pra ver os preços e o prazo de entrega da sua região.
              </p>
            </div>

            <div className="relative mt-5">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPickedId("");
                }}
                placeholder="Digite o seu bairro..."
                autoComplete="off"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />

              {!pickedId && matches.length > 0 && (
                <ul className="mt-1 max-h-44 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  {matches.map((z) => (
                    <li key={z.id}>
                      <button
                        type="button"
                        onClick={() => pick(z.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-cream"
                      >
                        <span className="font-semibold text-brand-black">{z.name}</span>
                        <span className="text-xs text-gray-500">{z.city}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!pickedId && query.trim() && matches.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Não encontramos esse bairro. Confira a escrita ou fale com a gente no WhatsApp.
                </p>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                Seu WhatsApp <span className="font-normal text-gray-400">(opcional — pra ver seus pedidos)</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="(21) 99999-9999"
                autoComplete="tel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>

            <button
              onClick={() => {
                if (!resolvedId) return;
                setPhone(phoneInput);
                setRevealed(true);
              }}
              disabled={!resolvedId}
              className={`mt-4 w-full rounded-full px-6 py-3 font-bold text-white transition ${
                resolvedId ? "bg-brand-amber hover:brightness-110" : "cursor-not-allowed bg-gray-300"
              }`}
            >
              Ver preços da minha região
            </button>

            <p className="mt-3 text-center text-xs text-gray-400">
              Não achou seu bairro? Fale com a gente no WhatsApp que a gente confere a cobertura.
            </p>
          </>
        ) : chosen ? (
          <div className="text-center">
            <p className="text-5xl">🎉</p>
            <h2 className="mt-2 text-2xl font-extrabold text-brand-black">
              Boaa! Essa é sua.
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Só hoje, quem é de <span className="font-semibold">{chosen.name}</span> ganhou:
            </p>

            <div className="mt-5 space-y-2">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-brand-amber px-4 py-3 text-lg font-extrabold text-white">
                <span>🔥 Oferta por tempo limitado</span>
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  Acaba em <Countdown className="text-white" />
                </span>
              </div>
              <div className="rounded-xl bg-brand-black px-4 py-3 text-lg font-extrabold text-brand-gold">
                🚚 Frete grátis pra sua região
              </div>
            </div>

            <button
              onClick={() => setZone(resolvedId)}
              className="mt-6 w-full rounded-full bg-brand-amber px-6 py-3 font-bold text-white transition hover:brightness-110"
            >
              Aproveitar agora
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
