import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPricing } from "./fetch-pricing.ts";

const OK_BODY = {
  ok: true,
  data: {
    products: [{ id: "belco-30l", tiers: [450, 400, 360] }],
    overrides: { "Zona Sul": [{ id: "belco-30l", tiers: [500, 450, 400] }] },
    whatsappNumber: "(21) 99376-5465",
  },
};

// fetch falso: cada chamada consome a próxima resposta da fila.
function mockFetch(respostas: Array<"throw" | "hang" | { status: number; body: unknown }>) {
  let chamadas = 0;
  (globalThis as { fetch: unknown }).fetch = (_url: string, init?: { signal?: AbortSignal }) => {
    const r = respostas[Math.min(chamadas++, respostas.length - 1)];
    if (r === "throw") return Promise.reject(new Error("rede"));
    if (r === "hang")
      return new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("abort"))));
    return Promise.resolve({ ok: r.status < 400, json: async () => r.body });
  };
  return () => chamadas;
}

const rapido = { esperasMs: [0, 1, 1], timeoutMs: 30 };

test("devolve preços e normaliza o WhatsApp", async () => {
  mockFetch([{ status: 200, body: OK_BODY }]);
  const res = await fetchPricing("x", rapido);
  assert.ok(res);
  assert.deepEqual(res.data.products, OK_BODY.data.products);
  assert.deepEqual(res.data.extraRegions, {});
  assert.equal(res.whatsappNumber, "21993765465");
});

test("tenta de novo depois de erro de rede e de 500", async () => {
  const n = mockFetch(["throw", { status: 500, body: {} }, { status: 200, body: OK_BODY }]);
  const res = await fetchPricing("x", rapido);
  assert.ok(res);
  assert.equal(n(), 3);
});

test("painel travado: timeout em cada tentativa e devolve null", async () => {
  const n = mockFetch(["hang"]);
  const res = await fetchPricing("x", rapido);
  assert.equal(res, null);
  assert.equal(n(), 3);
});

test("resposta sem ok/data conta como falha", async () => {
  mockFetch([{ status: 200, body: { ok: false } }]);
  assert.equal(await fetchPricing("x", rapido), null);
});
