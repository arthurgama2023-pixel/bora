import { describe, expect, it, vi } from "vitest";

// reports.ts instancia o PrismaClient no topo do módulo. getReportPeriodRange é
// função pura (só faz conta de data), então o banco é substituído por um stub —
// o teste não precisa de conexão nem de DATABASE_URL.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { getReportPeriodRange } = await import("./reports");

// Por que este teste existe: o Histórico Financeiro compara "período atual" com
// "período anterior". Se os intervalos escorregarem um dia — ou se sobrepuserem —
// o faturamento aparece com número errado na tela, sem erro nenhum. É o tipo de
// bug que só aparece quando o cliente questiona o valor.

// Data fixa de referência: quarta-feira, 29/07/2026, 15h.
const REF = new Date(2026, 6, 29, 15, 0, 0);

const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe("getReportPeriodRange — semana", () => {
  it("cobre os últimos 7 dias corridos, terminando hoje", () => {
    const r = getReportPeriodRange("semana", REF);
    expect(dia(r.from)).toBe("2026-7-23"); // 6 dias antes
    expect(dia(r.to)).toBe("2026-7-29"); // hoje
  });

  it("pega o dia inteiro nas pontas (não corta por hora)", () => {
    // Se `from` não começasse 00:00, movimentação da manhã do 1º dia sumiria
    // do relatório; se `to` não fosse 23:59, a de hoje à noite sumiria.
    const r = getReportPeriodRange("semana", REF);
    expect([r.from.getHours(), r.from.getMinutes()]).toEqual([0, 0]);
    expect([r.to.getHours(), r.to.getMinutes()]).toEqual([23, 59]);
  });

  it("o período anterior são os 7 dias imediatamente antes, sem sobrepor", () => {
    const r = getReportPeriodRange("semana", REF);
    expect(dia(r.prevFrom)).toBe("2026-7-16");
    expect(dia(r.prevTo)).toBe("2026-7-22");
    // a comparação "subiu/caiu" mente se os dois períodos compartilharem um dia
    expect(r.prevTo.getTime()).toBeLessThan(r.from.getTime());
  });

  it("os dois períodos têm o mesmo tamanho (7 dias) — senão a comparação é injusta", () => {
    const r = getReportPeriodRange("semana", REF);
    const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
    expect(dias(r.from, r.to)).toBe(dias(r.prevFrom, r.prevTo));
  });
});

describe("getReportPeriodRange — mês", () => {
  it("vai do dia 1 até hoje", () => {
    const r = getReportPeriodRange("mes", REF);
    expect(dia(r.from)).toBe("2026-7-1");
    expect(dia(r.to)).toBe("2026-7-29");
  });

  it("o período anterior é o mês anterior INTEIRO", () => {
    const r = getReportPeriodRange("mes", REF);
    expect(dia(r.prevFrom)).toBe("2026-6-1"); // 1º de junho
    expect(dia(r.prevTo)).toBe("2026-6-30"); // 30 de junho (último dia)
  });

  it("acerta o último dia de meses de tamanhos diferentes", () => {
    // Fevereiro (28) e o mês anterior a ele (janeiro, 31) — clássico ponto de erro.
    const emMarco = getReportPeriodRange("mes", new Date(2026, 2, 10, 12));
    expect(dia(emMarco.prevFrom)).toBe("2026-2-1");
    expect(dia(emMarco.prevTo)).toBe("2026-2-28"); // fevereiro de 2026 tem 28 dias

    const emFevereiro = getReportPeriodRange("mes", new Date(2026, 1, 10, 12));
    expect(dia(emFevereiro.prevTo)).toBe("2026-1-31");
  });

  it("atravessa a virada de ano sem quebrar", () => {
    // Em janeiro, o mês anterior é dezembro do ano PASSADO.
    const emJaneiro = getReportPeriodRange("mes", new Date(2026, 0, 15, 12));
    expect(dia(emJaneiro.from)).toBe("2026-1-1");
    expect(dia(emJaneiro.prevFrom)).toBe("2025-12-1");
    expect(dia(emJaneiro.prevTo)).toBe("2025-12-31");
  });

  it("no dia 1º o período atual é só aquele dia (não fica vazio nem negativo)", () => {
    const r = getReportPeriodRange("mes", new Date(2026, 6, 1, 9));
    expect(dia(r.from)).toBe("2026-7-1");
    expect(dia(r.to)).toBe("2026-7-1");
    expect(r.to.getTime()).toBeGreaterThan(r.from.getTime());
  });
});
