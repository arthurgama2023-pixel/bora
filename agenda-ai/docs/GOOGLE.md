# Integração com o Google Calendar

O código do Google Calendar já está pronto ([google.ts](../src/modules/calendar/google.ts)):
criar, editar, excluir, consultar eventos, detectar conflitos, achar horários livres e
refresh automático de token. Falta só criar as credenciais OAuth no Google e colá-las
no `.env`.

## 1. Criar as credenciais no Google Cloud Console

1. Acesse <https://console.cloud.google.com> e crie (ou selecione) um projeto.
2. **APIs e serviços → Biblioteca** → habilite a **Google Calendar API**.
3. **APIs e serviços → Tela de consentimento OAuth**:
   - Tipo: **Externo**
   - Preencha nome do app, e-mail de suporte e de contato.
   - **Escopos**: adicione `calendar.events` e `calendar.readonly` (o app pede exatamente
     esses — princípio do menor privilégio; não pedimos gerenciar calendários de terceiros).
   - Em **Test users**, adicione os e-mails que vão testar enquanto o app não é verificado.
4. **APIs e serviços → Credenciais → Criar → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - **URIs de redirecionamento autorizados**:
     - Local: `http://localhost:3050/api/auth/google/callback`
     - Produção: `https://SEU-APP.onrender.com/api/auth/google/callback`
   - **Origens JavaScript autorizadas**: `http://localhost:3050` e a URL de produção.

## 2. Colar no `.env`

```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
APP_URL=http://localhost:3050   # em produção, a URL pública (usada no redirect)
```

Reinicie o servidor. O botão **"Conectar Google Calendar"** no topo do painel deixa
de aparecer como "Agenda local (demo)" e passa a iniciar o fluxo real.

## 3. Como cada tipo de usuário conecta

| Origem | Como conecta |
|---|---|
| **Web** | Clica em "Entrar com Google" no login, ou "Conectar Google Calendar" no topo. |
| **WhatsApp** | Escreve "conectar meu google calendar"; o agente devolve um link que abre a autorização no navegador. Ver [WHATSAPP.md](WHATSAPP.md). |

## 4. Segurança dos tokens

- `access_token` e `refresh_token` são criptografados com **AES-256-GCM**
  ([crypto.ts](../src/lib/crypto.ts)) antes de irem para o banco.
- O token **nunca** chega ao navegador; todo acesso ao Google é server-side.
- O refresh é automático: quando o `access_token` expira, o app usa o `refresh_token`
  para renovar sem incomodar o usuário.

## 5. Publicação (sair do modo de teste)

Enquanto o app estiver "Em teste" na tela de consentimento, só os **test users**
cadastrados conseguem conectar. Para liberar para qualquer pessoa, publique o app —
o Google pode exigir verificação (revisão de escopos), o que leva alguns dias. Para
uso interno/piloto, o modo de teste com a lista de e-mails é suficiente.

## Como funciona por baixo (referência)

- `GET /api/auth/google` — monta a URL de consentimento. Aceita `?link=` (token assinado)
  para o fluxo vindo do WhatsApp, onde o usuário já é identificado pelo telefone.
- `GET /api/auth/google/callback` — troca o `code` por tokens, busca o perfil, cria/atualiza
  o usuário e grava a integração criptografada. O `state` é um JWT assinado (não um cookie),
  para sobreviver a webviews de celular que descartam cookies no redirect.
- `getCalendarForUser()` ([calendar/index.ts](../src/modules/calendar/index.ts)) devolve o
  `GoogleCalendarProvider` se houver integração ativa, senão o `LocalCalendarProvider`.
