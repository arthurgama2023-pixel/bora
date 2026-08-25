"use client";

import { useEffect, useState } from "react";
import { PEDIDOS_URL } from "@/lib/tabela";

interface PedidoItem {
  produto: string;
  quantidade: number;
}
interface Pedido {
  numero: number;
  tipo: string;
  data: string;
  itens: PedidoItem[];
}
interface Resposta {
  encontrado: boolean;
  nome?: string;
  pedidos: Pedido[];
}

// Modal "Meus Pedidos": busca no KegControl pelo telefone que o cliente
// informou e lista as movimentacoes que ele reconhece como pedido.
export default function MeusPedidosModal({
  phone,
  onClose,
}: {
  phone: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [data, setData] = useState<Resposta | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErro(false);
    fetch(`${PEDIDOS_URL}?telefone=${encodeURIComponent(phone)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (!json?.ok) {
          setErro(true);
          return;
        }
        setData(json.data);
      })
      .catch(() => alive && setErro(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [phone]);

  const fmtData = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-brand-black">Meus Pedidos</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {loading && <p className="py-8 text-center text-sm text-gray-500">Buscando seus pedidos…</p>}

        {!loading && erro && (
          <p className="py-8 text-center text-sm text-gray-500">
            Não conseguimos carregar agora. Tente de novo em instantes.
          </p>
        )}

        {!loading && !erro && data && !data.encontrado && (
          <div className="py-8 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-2 text-sm text-gray-600">
              Não encontramos pedidos com esse telefone. Se você já comprou com a gente,
              confira se digitou o mesmo número — ou fale no WhatsApp.
            </p>
          </div>
        )}

        {!loading && !erro && data?.encontrado && data.pedidos.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-4xl">🍺</p>
            <p className="mt-2 text-sm text-gray-600">
              Oi{data.nome ? `, ${data.nome}` : ""}! Ainda não temos pedidos registrados no seu
              cadastro. Faça seu primeiro pedido pelo site.
            </p>
          </div>
        )}

        {!loading && !erro && data?.encontrado && data.pedidos.length > 0 && (
          <>
            {data.nome && (
              <p className="mb-3 text-sm text-gray-600">
                Oi, <span className="font-semibold text-brand-black">{data.nome}</span>! Seus últimos pedidos:
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {data.pedidos.map((p) => (
                <li key={p.numero} className="rounded-xl border border-brand-black/10 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-brand-cream px-2 py-0.5 text-xs font-bold text-brand-black">
                      {p.tipo}
                    </span>
                    <span className="text-xs text-gray-500">{fmtData(p.data)}</span>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {p.itens.map((it, i) => (
                      <li key={i} className="text-sm text-gray-700">
                        {it.quantidade}x {it.produto}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
