import { NextResponse } from "next/server";
import { readStoredFile } from "@/services/storage";

const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const file = await readStoredFile(name);
  if (!file) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(file.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
