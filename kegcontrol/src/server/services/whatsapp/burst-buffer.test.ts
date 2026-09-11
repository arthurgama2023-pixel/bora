import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WINDOW_MS, enqueueBurst, joinBurst, _resetBursts } from "./burst-buffer";

describe("joinBurst", () => {
  it("junta os pedaços em uma mensagem só, uma por linha", () => {
    expect(joinBurst(["quero chopp", "belco 50", "2 barris"])).toBe("quero chopp\nbelco 50\n2 barris");
  });
  it("apara espaços e descarta linhas vazias", () => {
    expect(joinBurst(["  oi  ", "", "   ", "belco"])).toBe("oi\nbelco");
  });
});

describe("enqueueBurst (agrupamento de rajada)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetBursts();
  });
  afterEach(() => {
    _resetBursts();
    vi.useRealTimers();
  });

  it("3 mensagens dentro da janela viram UM flush com tudo junto", () => {
    const flush = vi.fn();
    enqueueBurst("k1", "quero chopp", flush, 2500);
    vi.advanceTimersByTime(1000);
    enqueueBurst("k1", "belco 50", flush, 2500);
    vi.advanceTimersByTime(1000);
    enqueueBurst("k1", "2 barris", flush, 2500);

    // Ainda não passou a janela desde a última — não deve ter processado.
    vi.advanceTimersByTime(2000);
    expect(flush).not.toHaveBeenCalled();

    // Passou a janela cheia sem nova mensagem → processa UMA vez, tudo junto.
    vi.advanceTimersByTime(500);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith("quero chopp\nbelco 50\n2 barris");
  });

  it("mensagens separadas por mais que a janela viram flushes distintos", () => {
    const flush = vi.fn();
    enqueueBurst("k2", "primeira", flush, 2500);
    vi.advanceTimersByTime(2600); // passa a janela → flush 1
    enqueueBurst("k2", "segunda", flush, 2500);
    vi.advanceTimersByTime(2600); // passa a janela → flush 2

    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenNthCalledWith(1, "primeira");
    expect(flush).toHaveBeenNthCalledWith(2, "segunda");
  });

  it("telefones diferentes não se misturam", () => {
    const flushA = vi.fn();
    const flushB = vi.fn();
    enqueueBurst("A", "oi A", flushA, 2500);
    enqueueBurst("B", "oi B", flushB, 2500);
    vi.advanceTimersByTime(2600);
    expect(flushA).toHaveBeenCalledTimes(1);
    expect(flushA).toHaveBeenCalledWith("oi A");
    expect(flushB).toHaveBeenCalledTimes(1);
    expect(flushB).toHaveBeenCalledWith("oi B");
  });

  it("uma mensagem só ainda é processada (depois da janela)", () => {
    const flush = vi.fn();
    enqueueBurst("k3", "quero 2 belco 50 pra figueira", flush, 2500);
    vi.advanceTimersByTime(2499);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith("quero 2 belco 50 pra figueira");
  });

  it("a janela padrão é 2,5s", () => {
    expect(DEFAULT_WINDOW_MS).toBe(2500);
  });
});
