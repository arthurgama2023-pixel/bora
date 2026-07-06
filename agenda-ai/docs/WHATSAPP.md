# Conectar o Agenda AI ao WhatsApp

O agente já fala WhatsApp — falta só ligar um **provedor de WhatsApp** e apontar o
webhook para o app. Usamos a **Evolution API** (a mesma do projeto Ambiente Verde):
self-hosted, conecta via QR code (WhatsApp Web), sem custo por mensagem e sem a
burocracia de aprovação da API oficial da Meta.

> Trade-off honesto: a Evolution usa o WhatsApp **não-oficial** (número comum lido por
> QR code). É perfeita para validar e operar com um número dedicado. Para escala/marca
> verificada, o mesmo código migra para a **Cloud API oficial da Meta** — basta uma nova
> implementação de `Channel` (o núcleo não muda). Veja o final deste documento.

## Visão geral do fluxo

```
Usuário no WhatsApp
      │  manda mensagem (texto ou áudio)
      ▼
Evolution API  ──webhook──►  {APP_URL}/api/webhooks/whatsapp?token=...
      ▲                              │
      │  resposta                    ▼
      └──────────────  Agenda AI: identifica o usuário pelo telefone,
                       interpreta (Gemini), mexe no calendário, responde
```

## Jeito fácil: a aba "Conectar WhatsApp"

O app tem uma aba de autoatendimento (botão **Conectar WhatsApp** no topo do painel,
ou acesse `/conectar`). Nela você:

1. Informa a **URL** e a **API Key** do seu servidor Evolution (guardadas no banco, com a
   chave criptografada — não precisa editar `.env` nem reiniciar).
2. Clica em **Gerar instância e QR** — o app cria a instância, aponta o webhook de volta
   para si mesmo automaticamente e mostra o **QR code**.
3. Escaneia o QR com o WhatsApp do número dedicado. A tela detecta a conexão sozinha.

Você ainda precisa de um **servidor Evolution** rodando (passo abaixo). O que a aba
elimina é toda a parte manual de criar instância, ler QR por curl e configurar webhook.

> Em `localhost`, o QR conecta normalmente, mas para o agente **receber** mensagens o
> servidor Evolution precisa alcançar uma URL pública — use um túnel (ngrok/cloudflared)
> ou faça o deploy no Render. A aba avisa quando detecta `localhost`.

## Passo a passo manual (referência / automação)

### 1. Subir uma instância da Evolution API

Opção mais rápida (Docker):

```bash
docker run -d --name evolution \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=uma-chave-forte-sua \
  atendai/evolution-api:latest
```

Ou use uma Evolution já hospedada (você já tem uma no Ambiente Verde — dá para
criar uma **instância nova** nela só para o Agenda AI).

### 2. Criar e conectar a instância (ler o QR code)

```bash
# cria a instância
curl -X POST https://SUA-EVOLUTION/instance/create \
  -H "apikey: SUA_CHAVE" -H "content-type: application/json" \
  -d '{"instanceName":"agenda","integration":"WHATSAPP-BAILEYS"}'

# pega o QR code para escanear com o WhatsApp do número dedicado
curl https://SUA-EVOLUTION/instance/connect/agenda -H "apikey: SUA_CHAVE"
```

Escaneie o QR com o celular do número que será o "assistente".

### 3. Preencher o `.env` do Agenda AI

```env
EVOLUTION_API_URL=https://SUA-EVOLUTION
EVOLUTION_API_KEY=SUA_CHAVE
EVOLUTION_INSTANCE=agenda
WHATSAPP_WEBHOOK_TOKEN=um-segredo-qualquer   # protege o endpoint do webhook
GROQ_API_KEY=gsk_...                          # opcional: habilita áudio no WhatsApp
```

### 4. Apontar o webhook da Evolution para o app

```bash
curl -X POST https://SUA-EVOLUTION/webhook/set/agenda \
  -H "apikey: SUA_CHAVE" -H "content-type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://SEU-APP.onrender.com/api/webhooks/whatsapp?token=um-segredo-qualquer",
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

Em desenvolvimento local, exponha a porta 3050 com um túnel (ngrok/cloudflared) e
use a URL pública do túnel no lugar de `SEU-APP.onrender.com`.

### 5. Pronto — testar

Mande no WhatsApp do número conectado:

- "Marca reunião com o financeiro amanhã às 10h"
- "Tenho algo hoje?"
- "Cancela o dentista"
- Um **áudio** dizendo o compromisso — transcrito automaticamente pelo Gemini (a mesma
  chave da IA; sem precisar de chave do Groq). Se `GROQ_API_KEY` estiver definida, o Groq
  Whisper é usado no lugar (mais barato/rápido para transcrição pura).

## Restringir quem o agente atende

Por padrão o agente responde qualquer número. Para restringir a uma lista fechada
(ex.: só você), há duas formas — **use a mais fácil, o painel**:

- **No painel** (recomendado): aba **Conectar WhatsApp** → cartão **"Quem o agente atende"**
  → digite o número e salve. Fica guardado no banco, sem redeploy.
- **Por env var**: `WHATSAPP_ALLOWED_NUMBERS=21980828309` (o painel tem prioridade sobre ela).

Aceita vários números separados por vírgula (`21980828309,11988887777`), com ou
sem o DDI 55 — a checagem normaliza os dois lados. Mensagens de números fora da
lista são **ignoradas silenciosamente**: nenhuma resposta é enviada, nenhum
usuário é criado no banco e nenhuma chamada de IA é feita — o número nem sabe
que o agente existe. Deixe vazio para atender todo mundo.

## Como o usuário conecta o Google Calendar dele

O WhatsApp não abre a tela de consentimento do Google. Então o agente entende o
pedido e devolve um **link mágico**:

1. Usuário: "quero conectar meu google calendar"
2. Agente responde com um link `{APP_URL}/api/auth/google?link=...` (expira em 15 min)
3. Usuário abre no navegador do celular, autoriza no Google
4. A conta Google fica ligada ao **telefone** dele — dali em diante, tudo que ele
   pedir no WhatsApp vai direto para o Google Calendar real.

Enquanto não conectar, cada usuário tem uma **agenda local** própria (funciona,
só não sincroniza com o Google). Detalhes de OAuth em [GOOGLE.md](GOOGLE.md).

## Migrar para a API oficial da Meta (futuro)

Quando quiser número verificado/escala, crie
`src/modules/channels/whatsapp-cloud.ts` implementando a mesma interface `Channel`
(`parseWebhook`, `fetchAudio`, `sendMessage`) com os endpoints da Cloud API, e troque
a fábrica em `src/modules/channels/index.ts`. **Nada no núcleo muda** — é o motivo de o
canal ser uma interface isolada.
