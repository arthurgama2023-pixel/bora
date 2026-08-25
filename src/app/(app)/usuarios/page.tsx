import { redirect } from "next/navigation";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/enums";
import { formatDate } from "@/lib/utils";
import { listUsers } from "@/server/services/users";
import { UserActions, UserCreateButton } from "./user-actions";

export const metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const users = await listUsers(session.companyId);

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Controle de acesso por papel: Administrador, Gerente e Estoquista"
        actions={<UserCreateButton />}
      />
      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Papel</Th>
            <Th>Status</Th>
            <Th>Criado em</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-muted/40">
              <Td className="font-medium">{u.name}</Td>
              <Td>{u.email}</Td>
              <Td>
                <Badge tone={u.role === "ADMIN" ? "brand" : "neutral"}>
                  {ROLE_LABELS[u.role as Role] ?? u.role}
                </Badge>
              </Td>
              <Td>
                <Badge tone={u.active ? "success" : "danger"}>
                  {u.active ? "Ativo" : "Inativo"}
                </Badge>
              </Td>
              <Td className="text-xs">{formatDate(u.createdAt)}</Td>
              <Td>
                <UserActions
                  user={{ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }}
                  isSelf={u.id === session.userId}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
