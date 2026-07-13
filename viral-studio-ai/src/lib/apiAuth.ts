// Guardas de autorização para route handlers. Toda rota de projeto/mídia passa
// por aqui: exige sessão válida e confirma que o projeto pertence ao usuário.
import { NextResponse } from "next/server";
import { getProject } from "./db";
import { currentUser } from "./auth";
import type { ProjectRow, UserRow } from "./types";

export function unauthorized(): NextResponse {
  // `auth: true` sinaliza ao cliente para redirecionar ao /login.
  return NextResponse.json({ error: "Sessão expirada. Faça login novamente.", auth: true }, { status: 401 });
}

// Retorna o usuário logado OU uma Response 401 pronta para devolver.
export async function authed(): Promise<{ user: UserRow } | { res: NextResponse }> {
  const user = await currentUser();
  if (!user) return { res: unauthorized() };
  return { user };
}

// Confirma dono do projeto. 404 (não 403) quando é de outra conta: não revela
// que o id existe para quem não é dono.
export function ownProject(
  user: UserRow,
  id: string
): { project: ProjectRow } | { res: NextResponse } {
  const project = getProject(id);
  if (!project || project.user_id !== user.id) {
    return { res: NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 }) };
  }
  return { project };
}

// Açúcar: exige login + dono em uma tacada. Devolve `res` (para retornar) ou
// `{ user, project }`.
export async function authedOwner(
  id: string
): Promise<{ res: NextResponse } | { user: UserRow; project: ProjectRow }> {
  const a = await authed();
  if ("res" in a) return a;
  const o = ownProject(a.user, id);
  if ("res" in o) return o;
  return { user: a.user, project: o.project };
}
