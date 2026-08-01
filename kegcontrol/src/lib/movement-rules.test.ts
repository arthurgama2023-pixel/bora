import { describe, expect, it } from "vitest";
import { MOVEMENT_TYPES, type Location } from "@/lib/enums";
import { itemInvolvesCustomer, TYPE_RULES, validateFlow } from "./movement-rules";

// Por que este teste existe: estas regras são a única barreira entre o usuário
// e um lançamento sem sentido no livro-caixa de barris (ex.: uma "Entrega" que
// tira barril do cliente em vez de entregar). Como o estoque é atualizado por
// partida dobrada, um fluxo aceito indevidamente corrompe o saldo — e o número
// errado só aparece semanas depois, na conferência física.

describe("validateFlow — fluxos legítimos de cada tipo", () => {
  it("Entrega só tira do depósito e põe no cliente", () => {
    expect(validateFlow("DELIVERY", "WAREHOUSE", "CUSTOMER")).toBe(true);
    // o inverso seria uma retirada disfarçada de entrega
    expect(validateFlow("DELIVERY", "CUSTOMER", "WAREHOUSE")).toBe(false);
    expect(validateFlow("DELIVERY", "WAREHOUSE", "LOST")).toBe(false);
  });

  it("Retirada só traz do cliente de volta pro depósito", () => {
    expect(validateFlow("PICKUP", "CUSTOMER", "WAREHOUSE")).toBe(true);
    expect(validateFlow("PICKUP", "WAREHOUSE", "CUSTOMER")).toBe(false);
  });

  it("Troca aceita as DUAS direções (é entrega + retirada na mesma visita)", () => {
    expect(validateFlow("SWAP", "WAREHOUSE", "CUSTOMER")).toBe(true);
    expect(validateFlow("SWAP", "CUSTOMER", "WAREHOUSE")).toBe(true);
    expect(validateFlow("SWAP", "WAREHOUSE", "LOST")).toBe(false);
  });

  it("Compra entra de fora; Venda sai pra fora — nunca o contrário", () => {
    expect(validateFlow("PURCHASE", "EXTERNAL", "WAREHOUSE")).toBe(true);
    expect(validateFlow("PURCHASE", "WAREHOUSE", "EXTERNAL")).toBe(false);

    expect(validateFlow("SALE", "WAREHOUSE", "EXTERNAL")).toBe(true);
    expect(validateFlow("SALE", "EXTERNAL", "WAREHOUSE")).toBe(false);
  });

  it("Perda aceita as 3 origens onde um barril pode sumir", () => {
    expect(validateFlow("LOSS", "WAREHOUSE", "LOST")).toBe(true);
    expect(validateFlow("LOSS", "CUSTOMER", "LOST")).toBe(true);
    expect(validateFlow("LOSS", "MAINTENANCE", "LOST")).toBe(true);
    // perda não pode "criar" barril vindo de fora
    expect(validateFlow("LOSS", "EXTERNAL", "LOST")).toBe(false);
  });

  it("Manutenção vai e volta do depósito", () => {
    expect(validateFlow("MAINTENANCE", "WAREHOUSE", "MAINTENANCE")).toBe(true);
    expect(validateFlow("MAINTENANCE", "MAINTENANCE", "WAREHOUSE")).toBe(true);
    expect(validateFlow("MAINTENANCE", "CUSTOMER", "MAINTENANCE")).toBe(false);
  });

  it("Ajuste é livre de propósito — é a válvula de escape auditada", () => {
    // allowedFlows vazio significa "qualquer fluxo". Se alguém adicionar uma
    // regra ao ADJUSTMENT sem querer, correções de inventário param de funcionar.
    expect(TYPE_RULES.ADJUSTMENT.allowedFlows).toHaveLength(0);
    const locais: Location[] = ["WAREHOUSE", "CUSTOMER", "MAINTENANCE", "LOST", "EXTERNAL"];
    for (const de of locais) {
      for (const para of locais) {
        expect(validateFlow("ADJUSTMENT", de, para)).toBe(true);
      }
    }
  });
});

describe("TYPE_RULES — exigência de cliente", () => {
  it("exige cliente exatamente nos tipos que tocam o cliente", () => {
    // Se um tipo passar a exigir/parar de exigir cliente sem querer, ou some a
    // trava (movimentação órfã) ou o operador fica travado sem motivo.
    const exigem = MOVEMENT_TYPES.filter((t) => TYPE_RULES[t].requiresCustomer);
    expect(exigem.sort()).toEqual(["DELIVERY", "PICKUP", "SWAP"].sort());
  });

  it("todo tipo de movimentação tem regra cadastrada", () => {
    // Tipo novo sem regra quebraria com "cannot read property of undefined"
    // só na hora que alguém tentasse usar.
    for (const tipo of MOVEMENT_TYPES) {
      expect(TYPE_RULES[tipo], `sem regra: ${tipo}`).toBeDefined();
    }
  });

  it("todo fluxo declarado como permitido realmente passa na validação", () => {
    // Coerência interna: a tabela e a função não podem divergir.
    for (const tipo of MOVEMENT_TYPES) {
      for (const fluxo of TYPE_RULES[tipo].allowedFlows) {
        expect(validateFlow(tipo, fluxo.from, fluxo.to), `${tipo}: ${fluxo.from}→${fluxo.to}`).toBe(true);
      }
    }
  });
});

describe("itemInvolvesCustomer", () => {
  it("detecta o cliente em qualquer uma das pontas", () => {
    expect(itemInvolvesCustomer({ fromLocation: "WAREHOUSE", toLocation: "CUSTOMER" })).toBe(true);
    expect(itemInvolvesCustomer({ fromLocation: "CUSTOMER", toLocation: "WAREHOUSE" })).toBe(true);
  });

  it("não acusa cliente onde não há", () => {
    // É essa checagem que impede gravar movimentação de cliente sem cliente.
    expect(itemInvolvesCustomer({ fromLocation: "WAREHOUSE", toLocation: "MAINTENANCE" })).toBe(false);
    expect(itemInvolvesCustomer({ fromLocation: "EXTERNAL", toLocation: "WAREHOUSE" })).toBe(false);
  });
});
