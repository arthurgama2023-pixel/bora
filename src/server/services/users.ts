import bcrypt from "bcryptjs";
import type { Session } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { userSchema, userUpdateSchema } from "@/lib/validation";
import type { z } from "zod";
import { logAudit } from "./audit";

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user || !user.active) {
    throw new ApiError(401, "E-mail ou senha inválidos");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, "E-mail ou senha inválidos");
  await logAudit(prisma, {
    companyId: user.companyId,
    userId: user.id,
    action: "LOGIN",
    entity: "User",
    entityId: user.id,
  });
  return user;
}

export async function listUsers(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });
}

export async function createUser(
  session: Session,
  data: z.infer<typeof userSchema>,
) {
  const dup = await prisma.user.findUnique({ where: { email: data.email } });
  if (dup) throw new ApiError(400, "Já existe um usuário com este e-mail");
  const user = await prisma.user.create({
    data: {
      companyId: session.companyId,
      name: data.name,
      email: data.email,
      role: data.role,
      active: data.active,
      passwordHash: await bcrypt.hash(data.password, 10),
    },
  });
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    changes: { nome: { de: null, para: user.name }, papel: user.role },
  });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function updateUser(
  session: Session,
  id: string,
  data: z.infer<typeof userUpdateSchema>,
) {
  const before = await prisma.user.findFirst({
    where: { id, companyId: session.companyId },
  });
  if (!before) throw new ApiError(404, "Usuário não encontrado");
  if (id === session.userId && data.active === false) {
    throw new ApiError(400, "Você não pode desativar seu próprio usuário");
  }
  if (id === session.userId && data.role && data.role !== "ADMIN") {
    throw new ApiError(400, "Você não pode rebaixar seu próprio papel");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.email ? { email: data.email } : {}),
      ...(data.role ? { role: data.role } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.password
        ? { passwordHash: await bcrypt.hash(data.password, 10) }
        : {}),
    },
  });
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    changes: {
      ...(data.role && data.role !== before.role
        ? { papel: { de: before.role, para: data.role } }
        : {}),
      ...(data.active !== undefined && data.active !== before.active
        ? { ativo: { de: before.active, para: data.active } }
        : {}),
      ...(data.password ? { senha: "redefinida" } : {}),
    },
  });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
