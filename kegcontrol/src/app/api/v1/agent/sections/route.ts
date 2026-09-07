import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getPersonalitySections, savePersonalitySections } from "@/server/services/agent";
import { SECTION_META, coerceSections } from "@/server/services/agent-personality";

// Seções canônicas da personalidade do agente. GET devolve o conteúdo atual (+
// os metadados das seções pra UI montar os rótulos); PUT salva as seções
// confirmadas e regenera o texto que o LLM recebe. Regras cruciais (preço,
// cadastro, ferramentas) NÃO vivem aqui — ficam travadas no código.
const bodySchema = z.object({
  sections: z.record(z.string(), z.string().max(6000)),
});

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { sections, source } = await getPersonalitySections(session.companyId);
    return { sections, source, meta: SECTION_META };
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { sections } = bodySchema.parse(await request.json());
    const { personality } = await savePersonalitySections(
      session.companyId,
      coerceSections(sections),
    );
    return { personality };
  });
}
