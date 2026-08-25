import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  await destroySession();
  return NextResponse.redirect(new URL("/login", env.APP_URL));
}
