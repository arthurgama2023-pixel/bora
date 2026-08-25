import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/env";

export async function GET() {
  return NextResponse.json({ ok: true, mock: isMockMode() });
}
