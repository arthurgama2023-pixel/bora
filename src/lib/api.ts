import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

type Handler<T> = () => Promise<T>;

// Envelope padrão das rotas: trata ApiError, ZodError e erros inesperados.
export async function handle<T>(fn: Handler<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    if (data instanceof NextResponse) return data;
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }
    if (err instanceof ZodError) {
      const msg = err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return NextResponse.json(
        { ok: false, error: `Dados inválidos — ${msg}` },
        { status: 400 },
      );
    }
    console.error(err);
    return NextResponse.json(
      { ok: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export function csvResponse(filename: string, rows: string[][]) {
  const escape = (v: string) =>
    /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  // BOM + ponto e vírgula: abre corretamente no Excel pt-BR
  const body =
    "﻿" + rows.map((r) => r.map(escape).join(";")).join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
