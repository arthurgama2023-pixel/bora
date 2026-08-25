// Repositório de dados do Meta AI.
//
// Dois drivers, selecionados automaticamente:
//  - PostgreSQL via Prisma quando DATABASE_URL está definida (Supabase);
//  - memória (globalThis, sobrevive ao HMR) em modo demo, sem configuração.
//
// As rotas de API só falam com estas funções — trocar o driver não muda nada
// no resto do app.
import { randomUUID } from "node:crypto";
// Type-only: apagado em runtime, seguro mesmo sem client Prisma instanciado.
import type { Prisma } from "@/generated/prisma/client";

export type DbUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  preferences: Record<string, unknown> | null;
  createdAt: Date;
};

export type DbConversation = {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ToolEvent = {
  tool: string;
  label: string;
  args?: Record<string, unknown>;
};

export type PendingAction = {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  details?: string[];
  status: "pending" | "confirmed" | "cancelled";
};

export type DbMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  toolEvents: ToolEvent[] | null;
  pendingAction: PendingAction | null;
  createdAt: Date;
};

export type DbMetaConnection = {
  id: string;
  userId: string;
  accessToken: string;
  adAccountId: string;
  adAccountName: string;
  currency: string;
  pageId: string | null;
  instagramId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
};

const useDatabase = () => Boolean(process.env.DATABASE_URL);

// ─── Driver em memória ────────────────────────────────────────────────────────

type MemoryStore = {
  users: Map<string, DbUser>;
  conversations: Map<string, DbConversation>;
  messages: Map<string, DbMessage>;
  metaConnections: Map<string, DbMetaConnection>; // key: userId
};

const globalStore = globalThis as unknown as { __metaaiStore?: MemoryStore };

function mem(): MemoryStore {
  if (!globalStore.__metaaiStore) {
    globalStore.__metaaiStore = {
      users: new Map(),
      conversations: new Map(),
      messages: new Map(),
      metaConnections: new Map(),
    };
  }
  return globalStore.__metaaiStore;
}

async function prisma() {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma();
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.user.findUnique({ where: { email } })) as DbUser | null;
  }
  for (const user of mem().users.values()) {
    if (user.email === email) return user;
  }
  return null;
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<DbUser> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.user.create({ data })) as DbUser;
  }
  const user: DbUser = {
    id: randomUUID(),
    ...data,
    preferences: null,
    createdAt: new Date(),
  };
  mem().users.set(user.id, user);
  return user;
}

// ─── Conversas ────────────────────────────────────────────────────────────────

export async function listConversations(
  userId: string,
): Promise<DbConversation[]> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    })) as DbConversation[];
  }
  return [...mem().conversations.values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function createConversation(
  userId: string,
  title = "Nova conversa",
): Promise<DbConversation> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.conversation.create({
      data: { userId, title },
    })) as DbConversation;
  }
  const conversation: DbConversation = {
    id: randomUUID(),
    userId,
    title,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mem().conversations.set(conversation.id, conversation);
  return conversation;
}

export async function getConversation(
  id: string,
  userId: string,
): Promise<DbConversation | null> {
  if (useDatabase()) {
    const db = await prisma();
    const found = await db.conversation.findUnique({ where: { id } });
    return found && found.userId === userId ? (found as DbConversation) : null;
  }
  const found = mem().conversations.get(id);
  return found && found.userId === userId ? found : null;
}

export async function touchConversation(id: string, title?: string) {
  if (useDatabase()) {
    const db = await prisma();
    await db.conversation.update({
      where: { id },
      data: title ? { title } : { updatedAt: new Date() },
    });
    return;
  }
  const found = mem().conversations.get(id);
  if (found) {
    found.updatedAt = new Date();
    if (title) found.title = title;
  }
}

export async function deleteConversation(id: string, userId: string) {
  if (useDatabase()) {
    const db = await prisma();
    await db.conversation.deleteMany({ where: { id, userId } });
    return;
  }
  const found = mem().conversations.get(id);
  if (found && found.userId === userId) {
    mem().conversations.delete(id);
    for (const [msgId, msg] of mem().messages) {
      if (msg.conversationId === id) mem().messages.delete(msgId);
    }
  }
}

// ─── Mensagens ────────────────────────────────────────────────────────────────

export async function listMessages(
  conversationId: string,
): Promise<DbMessage[]> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    })) as unknown as DbMessage[];
  }
  return [...mem().messages.values()]
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function addMessage(data: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  toolEvents?: ToolEvent[] | null;
  pendingAction?: PendingAction | null;
}): Promise<DbMessage> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        toolEvents: (data.toolEvents ?? undefined) as Prisma.InputJsonValue | undefined,
        pendingAction: (data.pendingAction ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })) as unknown as DbMessage;
  }
  const message: DbMessage = {
    id: randomUUID(),
    conversationId: data.conversationId,
    role: data.role,
    content: data.content,
    toolEvents: data.toolEvents ?? null,
    pendingAction: data.pendingAction ?? null,
    createdAt: new Date(),
  };
  mem().messages.set(message.id, message);
  return message;
}

export async function updateMessagePendingAction(
  messageId: string,
  pendingAction: PendingAction,
) {
  if (useDatabase()) {
    const db = await prisma();
    await db.message.update({
      where: { id: messageId },
      data: { pendingAction: pendingAction as unknown as Prisma.InputJsonValue },
    });
    return;
  }
  const found = mem().messages.get(messageId);
  if (found) found.pendingAction = pendingAction;
}

export async function getMessage(id: string): Promise<DbMessage | null> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.message.findUnique({
      where: { id },
    })) as unknown as DbMessage | null;
  }
  return mem().messages.get(id) ?? null;
}

// ─── Conexão Meta ─────────────────────────────────────────────────────────────

export async function getMetaConnection(
  userId: string,
): Promise<DbMetaConnection | null> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.metaConnection.findUnique({
      where: { userId },
    })) as DbMetaConnection | null;
  }
  return mem().metaConnections.get(userId) ?? null;
}

export async function upsertMetaConnection(data: {
  userId: string;
  accessToken: string;
  adAccountId: string;
  adAccountName: string;
  currency?: string;
  pageId?: string | null;
  instagramId?: string | null;
  expiresAt?: Date | null;
}): Promise<DbMetaConnection> {
  if (useDatabase()) {
    const db = await prisma();
    return (await db.metaConnection.upsert({
      where: { userId: data.userId },
      create: { ...data, currency: data.currency ?? "BRL" },
      update: { ...data, currency: data.currency ?? "BRL" },
    })) as DbMetaConnection;
  }
  const connection: DbMetaConnection = {
    id: randomUUID(),
    userId: data.userId,
    accessToken: data.accessToken,
    adAccountId: data.adAccountId,
    adAccountName: data.adAccountName,
    currency: data.currency ?? "BRL",
    pageId: data.pageId ?? null,
    instagramId: data.instagramId ?? null,
    expiresAt: data.expiresAt ?? null,
    createdAt: new Date(),
  };
  mem().metaConnections.set(data.userId, connection);
  return connection;
}

export async function deleteMetaConnection(userId: string) {
  if (useDatabase()) {
    const db = await prisma();
    await db.metaConnection.deleteMany({ where: { userId } });
    return;
  }
  mem().metaConnections.delete(userId);
}
