import { describe, expect, it } from "vitest";
import { matchProofsToOrders, PROOF_GRACE_MS } from "./site-orders";

const d = (iso: string) => new Date(iso);
const order = (id: string, phone: string, createdAt: string) => ({ id, phone, createdAt: d(createdAt) });
const proof = (id: string, phone: string, createdAt: string) => ({
  id,
  phone,
  createdAt: d(createdAt),
  caption: null,
});

describe("matchProofsToOrders — comprovante na janela do pedido", () => {
  it("casa o comprovante enviado DEPOIS do pedido", () => {
    const orders = [order("o1", "21993765465", "2026-09-21T15:00:00Z")];
    const proofs = [proof("p1", "21993765465", "2026-09-21T15:20:00Z")];
    const m = matchProofsToOrders(orders, proofs);
    expect(m.get("o1")?.id).toBe("p1");
  });

  it("NÃO casa comprovante antigo (de uma compra anterior) num pedido novo", () => {
    const orders = [order("o1", "5521993765465", "2026-09-21T15:00:00Z")];
    const proofs = [proof("p_velho", "5521993765465", "2026-09-14T02:00:00Z")];
    const m = matchProofsToOrders(orders, proofs);
    expect(m.has("o1")).toBe(false);
  });

  it("com dois pedidos do mesmo telefone, cada comprovante vai pro pedido certo", () => {
    const orders = [
      order("o_antigo", "2199999999", "2026-09-10T10:00:00Z"),
      order("o_novo", "2199999999", "2026-09-20T10:00:00Z"),
    ];
    const proofs = [
      proof("p_antigo", "2199999999", "2026-09-10T10:15:00Z"),
      proof("p_novo", "2199999999", "2026-09-20T10:15:00Z"),
    ];
    const m = matchProofsToOrders(orders, proofs);
    expect(m.get("o_antigo")?.id).toBe("p_antigo");
    expect(m.get("o_novo")?.id).toBe("p_novo");
  });

  it("um comprovante entre dois pedidos NÃO vaza pro pedido anterior", () => {
    const orders = [
      order("o1", "2198888888", "2026-09-10T10:00:00Z"),
      order("o2", "2198888888", "2026-09-20T10:00:00Z"),
    ];
    // comprovante chega depois do o2 → é do o2, não do o1
    const proofs = [proof("p", "2198888888", "2026-09-20T10:30:00Z")];
    const m = matchProofsToOrders(orders, proofs);
    expect(m.has("o1")).toBe(false);
    expect(m.get("o2")?.id).toBe("p");
  });

  it("aceita comprovante mandado pouco ANTES do registro (dentro da folga)", () => {
    const orders = [order("o1", "2197777777", "2026-09-21T15:00:00Z")];
    const proofs = [proof("p1", "2197777777", new Date(d("2026-09-21T15:00:00Z").getTime() - PROOF_GRACE_MS + 60_000).toISOString())];
    const m = matchProofsToOrders(orders, proofs);
    expect(m.get("o1")?.id).toBe("p1");
  });

  it("comprovante muito antes da folga NÃO casa", () => {
    const orders = [order("o1", "2196666666", "2026-09-21T15:00:00Z")];
    const proofs = [proof("p1", "2196666666", new Date(d("2026-09-21T15:00:00Z").getTime() - PROOF_GRACE_MS - 60_000).toISOString())];
    const m = matchProofsToOrders(orders, proofs);
    expect(m.has("o1")).toBe(false);
  });

  it("telefone diferente nunca casa", () => {
    const orders = [order("o1", "2195555555", "2026-09-21T15:00:00Z")];
    const proofs = [proof("p1", "2194444444", "2026-09-21T15:10:00Z")];
    const m = matchProofsToOrders(orders, proofs);
    expect(m.has("o1")).toBe(false);
  });

  it("quando há vários comprovantes na janela, pega o mais recente", () => {
    const orders = [order("o1", "2193333333", "2026-09-21T15:00:00Z")];
    const proofs = [
      proof("p1", "2193333333", "2026-09-21T15:10:00Z"),
      proof("p2", "2193333333", "2026-09-21T15:40:00Z"),
    ];
    const m = matchProofsToOrders(orders, proofs);
    expect(m.get("o1")?.id).toBe("p2");
  });
});
