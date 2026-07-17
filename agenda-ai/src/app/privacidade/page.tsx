import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Política de Privacidade — Agenda AI",
  description: "Como o Agenda AI coleta, usa e protege seus dados, incluindo dados do Google.",
};

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="16 de julho de 2026">
      <p>
        Esta Política descreve como o <strong>Agenda AI</strong> (&quot;nós&quot;, &quot;o app&quot;)
        coleta, usa, armazena e protege as informações dos usuários, incluindo os dados
        obtidos por meio das APIs do Google. Ao usar o Agenda AI, você concorda com as
        práticas aqui descritas.
      </p>

      <h2>1. O que o Agenda AI faz</h2>
      <p>
        O Agenda AI é um assistente que organiza sua agenda por conversa (texto ou voz),
        pela web ou pelo WhatsApp. Ele interpreta seus pedidos em linguagem natural e,
        quando você conecta o Google Calendar, cria, remarca, cancela e consulta
        compromissos na sua agenda — sempre sob seu comando.
      </p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li>
          <strong>Dados de conta Google</strong> (quando você conecta): seu nome, endereço
          de e-mail e foto de perfil, apenas para identificar sua conta.
        </li>
        <li>
          <strong>Dados do Google Calendar</strong>: eventos da sua agenda (horários, títulos,
          local), usados para detectar conflitos, encontrar horários livres e criar/editar
          compromissos que você solicita.
        </li>
        <li>
          <strong>Número de telefone</strong> (quando você usa o WhatsApp): para identificar
          sua conversa e responder a você.
        </li>
        <li>
          <strong>Mensagens e áudios</strong> que você envia ao assistente, para interpretar
          sua intenção e executar a ação pedida.
        </li>
      </ul>

      <h2>3. Como usamos os dados do Google</h2>
      <p>
        Usamos os dados da sua conta e do seu Google Calendar <strong>exclusivamente</strong> para
        fornecer as funcionalidades do assistente de agenda que você solicita: ler sua
        agenda para detectar conflitos e horários livres, e criar, editar ou remover eventos
        sob seu comando. <strong>Nunca</strong> alteramos sua agenda sem uma ação sua.
      </p>

      <h2>4. Uso Limitado (Google API Services User Data Policy)</h2>
      <p>
        O uso e a transferência, pelo Agenda AI, de informações recebidas das APIs do Google
        aderem à{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de <strong>Uso Limitado</strong>. Especificamente:
      </p>
      <ul>
        <li>Não usamos os dados do Google para publicidade.</li>
        <li>Não vendemos os dados do Google a terceiros.</li>
        <li>
          Não permitimos que humanos leiam seus dados do Google, exceto: com seu
          consentimento explícito para casos específicos, quando necessário por segurança
          (ex.: investigar abuso), ou para cumprir a lei.
        </li>
        <li>
          Usamos os dados apenas para fornecer e melhorar as funcionalidades visíveis ao
          usuário no próprio app.
        </li>
      </ul>

      <h2>5. Compartilhamento com terceiros</h2>
      <p>
        Não vendemos seus dados. Para funcionar, o texto ou áudio das suas mensagens é
        processado por provedores de inteligência artificial (como o Google Gemini) apenas
        para interpretar sua intenção de agenda e, no caso de áudio, transcrever. Esses
        provedores atuam como processadores e não recebem seus tokens de acesso ao Google
        Calendar. Não compartilhamos os eventos do seu calendário com esses provedores além
        do estritamente necessário para executar sua solicitação.
      </p>

      <h2>6. Armazenamento e segurança</h2>
      <p>
        Seus tokens de acesso ao Google são <strong>criptografados</strong> (AES-256-GCM) antes
        de serem armazenados e nunca são expostos ao seu navegador — todo acesso ao Google é
        feito de forma segura no servidor. Mantemos os dados apenas enquanto sua conta estiver
        ativa.
      </p>

      <h2>7. Seus direitos e revogação de acesso</h2>
      <p>
        Você pode revogar o acesso do Agenda AI à sua conta Google a qualquer momento em{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          myaccount.google.com/permissions
        </a>
        . Você também pode solicitar a exclusão dos seus dados entrando em contato conosco
        (ver seção 9). Ao revogar o acesso ou excluir sua conta, removemos seus tokens e
        dados associados.
      </p>

      <h2>8. Alterações nesta Política</h2>
      <p>
        Podemos atualizar esta Política periodicamente. Publicaremos a versão revisada nesta
        mesma página, com a data de atualização.
      </p>

      <h2>9. Contato</h2>
      <p>
        Dúvidas sobre esta Política ou sobre seus dados? Fale conosco pelo e-mail de suporte
        informado na tela de consentimento do app.
      </p>
    </LegalLayout>
  );
}
