import { test } from "node:test";
import assert from "node:assert/strict";
import { readPricingCache, writePricingCache, type RemotePricing } from "./pricing-cache.ts";

// localStorage falso (o cache só depende dele). Cada teste começa limpo.
function mockStorage(opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}) {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => {
      if (opts.throwOnGet) throw new Error("blocked");
      return map.has(k) ? map.get(k)! : null;
    },
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new Error("quota");
      map.set(k, v);
    },
    removeItem: (k: string) => map.delete(k),
    clear: () => map.clear(),
  };
  return map;
}

const SAMPLE: RemotePricing = {
  products: [{ id: "belco-50l", tiers: [600, 550, 500] }],
  overrides: { "Baixada Fluminense": [{ id: "belco-50l", tiers: [550, 500, 460] }] },
  extraRegions: {},
  removedRegions: {},
};

test("round-trip: escreve e lê de volta com os overrides por zona", () => {
  mockStorage();
  writePricingCache(SAMPLE, "5521999999999");
  const got = readPricingCache();
  assert.ok(got);
  assert.equal(got!.whatsappNumber, "5521999999999");
  assert.deepEqual(got!.data.overrides["Baixada Fluminense"][0].tiers, [550, 500, 460]);
});

test("sem cache → null", () => {
  mockStorage();
  assert.equal(readPricingCache(), null);
});

test("JSON corrompido → null (não quebra)", () => {
  const m = mockStorage();
  m.set("ss-chopp-pricing", "{ não é json");
  assert.equal(readPricingCache(), null);
});

test("formato inesperado (sem products) → null", () => {
  const m = mockStorage();
  m.set("ss-chopp-pricing", JSON.stringify({ savedAt: Date.now(), data: { foo: 1 } }));
  assert.equal(readPricingCache(), null);
});

test("cache vencido (> 45 dias) → null", () => {
  const m = mockStorage();
  const velho = Date.now() - 46 * 24 * 60 * 60 * 1000;
  m.set("ss-chopp-pricing", JSON.stringify({ savedAt: velho, data: SAMPLE, whatsappNumber: "x" }));
  assert.equal(readPricingCache(), null);
});

test("cache recente (dentro de 45 dias) → válido", () => {
  const m = mockStorage();
  const ontem = Date.now() - 24 * 60 * 60 * 1000;
  m.set("ss-chopp-pricing", JSON.stringify({ savedAt: ontem, data: SAMPLE, whatsappNumber: "x" }));
  assert.ok(readPricingCache());
});

test("localStorage bloqueado (getItem lança) → null, sem propagar", () => {
  mockStorage({ throwOnGet: true });
  assert.equal(readPricingCache(), null);
});

test("localStorage bloqueado (setItem lança) → não propaga", () => {
  mockStorage({ throwOnSet: true });
  assert.doesNotThrow(() => writePricingCache(SAMPLE, "x"));
});
