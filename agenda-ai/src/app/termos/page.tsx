import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Termos de Uso — Agenda AI",
  description: "Termos e condições para uso do assistente de agenda Agenda AI.",
};

export default function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso" updatedAt="16 de julho de 2026">
      <p>
        Estes Termos regem o uso do <strong>Agenda AI</strong>, um assistente que organiza sua
        agenda por conversa. Ao usar o app, você concorda com estes Termos.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O Agenda AI interpreta seus pedidos em linguagem natural (texto ou voz) para criar,
        remarcar, cancelar e consultar compromissos. Quando você conecta o Google Calendar,
        as ações são realizadas na sua agenda real, sempre sob seu comando.
      </p>

      <h2>2. Sua conta e responsabilidades</h2>
      <ul>
        <li>Você é responsável por manter a segurança da conta que usa para acessar o app.</li>
        <li>Você concorda em usar o app apenas para fins lícitos e de acordo com estes Termos.</li>
        <li>
          Você é responsável por conferir os compromissos criados ou alterados pelo assistente
          — recomendamos revisar sua agenda após ações importantes.
        </li>
      </ul>

      <h2>3. Integração com o Google</h2>
      <p>
        Ao conectar sua conta Google, você autoriza o Agenda AI a acessar seu Google Calendar
        conforme descrito na nossa{" "}
        <a href="/privacidade">Política de Privacidade</a>. Você pode revogar esse acesso a
        qualquer momento nas configurações da sua conta Google.
      </p>

      <h2>4. Disponibilidade e limitações</h2>
      <p>
        O serviço é fornecido &quot;como está&quot;. Nos esforçamos para manter o app disponível
        e preciso, mas não garantimos ausência de interrupções ou erros. A interpretação de
        linguagem natural pode, ocasionalmente, entender um pedido de forma diferente do
        pretendido — por isso a confirmação de ações sensíveis (como cancelamentos) é sua
        responsabilidade.
      </p>

      <h2>5. Limitação de responsabilidade</h2>
      <p>
        Na máxima extensão permitida por lei, o Agenda AI não se responsabiliza por perdas
        decorrentes de compromissos criados, alterados ou não criados em razão de erros de
        interpretação, indisponibilidade do serviço ou de serviços de terceiros (Google,
        provedores de IA, WhatsApp).
      </p>

      <h2>6. Alterações</h2>
      <p>
        Podemos atualizar estes Termos periodicamente. A versão vigente estará sempre nesta
        página, com a data de atualização.
      </p>

      <h2>7. Contato</h2>
      <p>
        Dúvidas sobre estes Termos? Fale conosco pelo e-mail de suporte informado na tela de
        consentimento do app.
      </p>
    </LegalLayout>
  );
}
