import { describe, expect, it } from "vitest";
import { ORDER_CLOSED_THANKS, PIX_ON_CLOSE_DISABLED, shieldPix } from "./agent";

describe("fechamento SEM PIX (decisão do dono)", () => {
  it("está ligado e o agradecimento avisa que a equipe entra em contato", () => {
    expect(PIX_ON_CLOSE_DISABLED).toBe(true);
    expect(ORDER_CLOSED_THANKS.toLowerCase()).toContain("obrigado");
    expect(ORDER_CLOSED_THANKS.toLowerCase()).toContain("equipe");
    expect(ORDER_CLOSED_THANKS.toLowerCase()).not.toContain("pix");
  });
  it("sem chave do sistema, a blindagem tira chave/ponteiro que a IA escrever", () => {
    const out = shieldPix("Pronto! ✅\nChave PIX: 12.345.678/0001-95\nA chave PIX vem na próxima mensagem 👇", null);
    expect(out).toContain("Pronto!");
    expect(out).not.toMatch(/12\.345\.678/);
    expect(out.toLowerCase()).not.toContain("próxima mensagem");
  });
});
