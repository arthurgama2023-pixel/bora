import { GoogleGenAI } from "@google/genai";
import { normalizeBrPhone } from "@/lib/phone";
import { getWhatsAppConfig, type WhatsAppConfig } from "./config";

// Transcreve um áudio (base64) para texto em pt-BR usando o Gemini (multimodal).
// Usado para o agente "ouvir" mensagens de voz do WhatsApp.
async function transcribeWithGemini(base64: string, mimeType: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Transcreva este áudio em português do Brasil. Responda APENAS com a transcrição literal do que a pessoa falou — sem comentários, sem aspas, sem rótulos.",
            },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
    });
    return (res.text ?? "").trim() || null;
  } catch (e) {
    console.error("[whatsapp] transcrição de áudio falhou:", e);
    return null;
  }
}

// Evolution API (self-hosted, WhatsApp Web via QR code / código de pareamento — não é a
// API oficial da Meta). Documentação: https://doc.evolution-api.com (formatos da v2).

interface EvolutionMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

interface EvolutionWebhookPayload {
  event?: string;
  instance?: string;
  data?: {
    key?: EvolutionMessageKey;
    pushName?: string;
    base64?: string; // alguns setups do Evolution já mandam a mídia aqui
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: { mimetype?: string };
      imageMessage?: { mimetype?: string; caption?: string };
      base64?: string;
    };
  };
}

export type ConnectionState = "open" | "connecting" | "close" | "unknown";

export interface WhatsAppStatus {
  configured: boolean;
  state: ConnectionState;
  qrBase64?: string; // data URI do QR code (fluxo sem número)
  pairingCode?: string; // código digitado no celular (fluxo com número)
  number?: string; // número conectado (quando state === "open")
  webhookUrl?: string;
  publicUrlWarning?: boolean; // APP_URL é localhost → webhook de entrada não alcançável
}

export interface IncomingMessage {
  externalId: string; // número do remetente
  pushName?: string;
  text?: string;
  // Mensagem de voz a ser transcrita (quando não é texto).
  audio?: { key: EvolutionMessageKey; base64?: string; mimetype?: string };
  // Foto (ex.: comprovante de PIX) — não passa pelo Gemini, só é guardada
  // para revisão humana na aba Verificação (ver PaymentProof).
  image?: { key: EvolutionMessageKey; base64?: string; mimetype?: string; caption?: string };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Eventos que a instância envia ao nosso webhook. MESSAGES_UPSERT = mensagens novas;
// CONNECTION_UPDATE = mudanças de estado (para detectarmos quedas/reconexões).
const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE"];

function phoneFromJid(jid: string): string {
  return jid.split("@")[0];
}

export class WhatsAppEvolutionChannel {
  // ---- Mensagens ----

  parseWebhook(raw: unknown): IncomingMessage | null {
    const payload = raw as EvolutionWebhookPayload;
    const data = payload?.data;
    const key = data?.key;
    if (!data || !key || key.fromMe) return null; // ignora eco das próprias mensagens
    // JID de grupo termina em "@g.us" (contato individual termina em
    // "@s.whatsapp.net"). O agente é pra atendimento 1:1 — nunca responde
    // dentro de grupo, mesmo que alguém o mencione ou responda a ele lá.
    if (key.remoteJid.endsWith("@g.us")) return null;

    const externalId = phoneFromJid(key.remoteJid);
    const text = data.message?.conversation ?? data.message?.extendedTextMessage?.text;
    if (text) return { externalId, pushName: data.pushName, text };
    // Mensagem de voz: devolve a chave (e o base64, se já veio no webhook) para
    // baixar e transcrever depois.
    if (data.message?.audioMessage) {
      return {
        externalId,
        pushName: data.pushName,
        audio: {
          key,
          base64: data.message.base64 ?? data.base64,
          mimetype: data.message.audioMessage.mimetype,
        },
      };
    }
    // Foto: provável comprovante de PIX. Devolve a chave pra baixar depois —
    // não tenta ler/validar aqui, só guarda pra revisão humana.
    if (data.message?.imageMessage) {
      return {
        externalId,
        pushName: data.pushName,
        image: {
          key,
          base64: data.message.base64 ?? data.base64,
          mimetype: data.message.imageMessage.mimetype,
          caption: data.message.imageMessage.caption,
        },
      };
    }
    return null;
  }

  // Busca o base64 de uma mídia (áudio ou imagem) no Evolution, se ela ainda
  // não veio pronta no próprio webhook. Compartilhado por transcribeAudio e
  // downloadImage — mesma chamada, o que muda é o que cada um faz depois.
  private async fetchMediaBase64(
    cfg: WhatsAppConfig,
    key: EvolutionMessageKey,
    base64Hint?: string,
    mimetypeHint?: string,
  ): Promise<{ base64: string; mimetype?: string } | null> {
    if (base64Hint) return { base64: base64Hint, mimetype: mimetypeHint };
    const res = await this.api(cfg, "POST", `/chat/getBase64FromMediaMessage/${cfg.instance}`, {
      message: { key },
      convertToMp4: false,
    });
    if (!res?.ok) {
      console.error("[whatsapp] getBase64FromMediaMessage falhou:", res?.status);
      return null;
    }
    const data = (await res.json().catch(() => null)) as { base64?: string; mimetype?: string } | null;
    if (!data?.base64) return null;
    return { base64: data.base64, mimetype: mimetypeHint ?? data.mimetype };
  }

  // Baixa o áudio (se necessário) e transcreve para texto em pt-BR.
  async transcribeAudio(
    companyId: string,
    audio: NonNullable<IncomingMessage["audio"]>,
  ): Promise<string | null> {
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) return null;
    const media = await this.fetchMediaBase64(cfg, audio.key, audio.base64, audio.mimetype);
    if (!media) return null;
    // "audio/ogg; codecs=opus" -> "audio/ogg" (o Gemini quer só o mime base).
    const mime = (media.mimetype ?? "audio/ogg").split(";")[0].trim();
    return transcribeWithGemini(media.base64, mime);
  }

  // Baixa a foto (se necessário) — sem interpretar o conteúdo, só entrega
  // pronta pra guardar como PaymentProof (ver webhook do WhatsApp).
  async downloadImage(
    companyId: string,
    image: NonNullable<IncomingMessage["image"]>,
  ): Promise<{ base64: string; mimetype: string } | null> {
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) return null;
    const media = await this.fetchMediaBase64(cfg, image.key, image.base64, image.mimetype);
    if (!media) return null;
    const mime = (media.mimetype ?? "image/jpeg").split(";")[0].trim();
    return { base64: media.base64, mimetype: mime };
  }

  // Retorna true se o Evolution aceitou o envio, false caso contrário — o
  // chamador (webhook) usa isso pra rastrear, ex.: a 2ª mensagem do PIX.
  async sendMessage(companyId: string, externalId: string, text: string): Promise<boolean> {
    // O núcleo gera **negrito** (markdown do chat web); o WhatsApp usa *negrito*.
    const whatsappText = text.replace(/\*\*(.+?)\*\*/g, "*$1*");
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) {
      console.warn("[whatsapp] Evolution não configurada — mensagem não enviada:", whatsappText);
      return false;
    }
    // delay: mostra "digitando..." por ~3s antes de entregar — parece humano
    // (o Evolution segura a mensagem e exibe a presença "composing" nesse tempo).
    const res = await this.api(cfg, "POST", `/message/sendText/${cfg.instance}`, {
      number: externalId,
      text: whatsappText,
      delay: 3000,
    });
    if (!res?.ok) {
      console.error("[whatsapp] falha ao enviar:", res?.status, await res?.text().catch(() => ""));
      return false;
    }
    return true;
  }

  // Envia uma imagem por URL pública (ex.: foto do barril publicada no site).
  // `mimetype`/`fileName` podem ser passados explicitamente: a tabela de preços
  // vem de uma URL com query-string (/api/tabela-precos?cidade=...), então o
  // palpite por extensão de arquivo não funciona e cairia no webp por engano.
  // Retorna `true` se a Evolution aceitou a mídia. O chamador pode usar isso
  // para cair num fallback em texto (ex.: mandar a tabela de preços escrita se
  // a imagem não foi entregue) — assim o cliente nunca fica sem a informação.
  async sendMedia(
    companyId: string,
    externalId: string,
    mediaUrl: string,
    caption?: string,
    opts?: { mimetype?: string; fileName?: string },
  ): Promise<boolean> {
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) {
      console.warn("[whatsapp] Evolution não configurada — mídia não enviada:", mediaUrl);
      return false;
    }
    const ext = mediaUrl.split("?")[0].split(".").pop()?.toLowerCase();
    const mimetype =
      opts?.mimetype ??
      (ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/webp");
    const res = await this.api(cfg, "POST", `/message/sendMedia/${cfg.instance}`, {
      number: externalId,
      mediatype: "image",
      mimetype,
      media: mediaUrl,
      caption,
      fileName: opts?.fileName ?? mediaUrl.split("?")[0].split("/").pop(),
      delay: 1000,
    });
    if (!res?.ok) {
      console.error("[whatsapp] falha ao enviar mídia:", res?.status, await res?.text().catch(() => ""));
      return false;
    }
    return true;
  }

  // ---- Gerenciamento de instância (aba Conectar) ----

  private async api(
    cfg: WhatsAppConfig,
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 12000,
  ): Promise<Response | null> {
    // TIMEOUT OBRIGATÓRIO em toda chamada ao Evolution. Sem isto, um servidor
    // lento/travado deixava o fetch pendurado para SEMPRE — o connect() nunca
    // resolvia, o endpoint nunca respondia e o painel ficava eterno em
    // "Gerando…". Com AbortController, nada trava: no pior caso a chamada falha
    // (retorna null, tratado pelos chamadores) e o usuário pode tentar de novo.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${cfg.apiUrl}${path}`, {
        method,
        headers: { "content-type": "application/json", apikey: cfg.apiKey },
        signal: ctrl.signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        console.error(`[whatsapp] timeout (${timeoutMs}ms) em ${method} ${path}`);
      } else {
        console.error("[whatsapp] erro de rede:", path, err);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private webhookUrl(cfg: WhatsAppConfig, appUrl: string): string {
    return `${appUrl.replace(/\/$/, "")}/api/webhooks/whatsapp?token=${cfg.webhookToken}`;
  }

  /** Estado + QR + número. Não cria nada — só lê. */
  async status(companyId: string, appUrl: string): Promise<WhatsAppStatus> {
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) return { configured: false, state: "unknown" };

    const base: WhatsAppStatus = {
      configured: true,
      state: "unknown",
      webhookUrl: this.webhookUrl(cfg, appUrl),
      publicUrlWarning: /localhost|127\.0\.0\.1/.test(appUrl),
    };

    const stateRes = await this.api(cfg, "GET", `/instance/connectionState/${cfg.instance}`, undefined, 6000);
    if (!stateRes || stateRes.status === 404) return base; // instância ainda não existe
    if (!stateRes.ok) return base;

    const data = (await stateRes.json().catch(() => null)) as
      | { instance?: { state?: string } }
      | null;
    const raw = data?.instance?.state;
    base.state =
      raw === "open" ? "open" : raw === "connecting" ? "connecting" : raw === "close" ? "close" : "unknown";

    if (base.state === "open") base.number = await this.connectedNumber(cfg);
    return base;
  }

  private async connectedNumber(cfg: WhatsAppConfig): Promise<string | undefined> {
    const res = await this.api(cfg, "GET", `/instance/fetchInstances?instanceName=${cfg.instance}`, undefined, 6000);
    if (!res?.ok) return undefined;
    const data = (await res.json().catch(() => null)) as unknown;
    const list = Array.isArray(data) ? data : [data];
    for (const item of list) {
      const rec = item as Record<string, unknown>;
      const inst = (rec.instance as Record<string, unknown>) ?? rec;
      const jid = (inst.ownerJid ?? inst.owner ?? inst.wuid) as string | undefined;
      if (jid) return phoneFromJid(jid);
    }
    return undefined;
  }

  private async readState(cfg: WhatsAppConfig): Promise<string> {
    // Timeout curto: é um poll de estado, chamado em loop — não pode segurar o
    // fluxo se o servidor engasgar numa leitura.
    const res = await this.api(cfg, "GET", `/instance/connectionState/${cfg.instance}`, undefined, 6000);
    if (!res) return "unknown";
    if (res.status === 404) return "missing";
    if (!res.ok) return "unknown";
    const data = (await res.json().catch(() => null)) as
      | { instance?: { state?: string }; state?: string }
      | null;
    return data?.instance?.state ?? data?.state ?? "close";
  }

  private async waitFor(
    cfg: WhatsAppConfig,
    cond: (s: string) => boolean,
    maxMs = 8000,
    gap = 600,
  ): Promise<boolean> {
    // Orçamento por TEMPO DE RELÓGIO (não por nº de tentativas): uma leitura de
    // estado lenta não pode multiplicar a espera. Nunca ultrapassa maxMs.
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (cond(await this.readState(cfg))) return true;
      await wait(gap);
    }
    return false;
  }

  /**
   * Conecta o número do agente. Com `number`, usa CÓDIGO DE PAREAMENTO (digitado no
   * celular em Aparelhos conectados → Conectar com número). Sem `number`, cai no QR.
   *
   * Para o pareamento ser válido, a instância precisa ser recriada do zero com o número
   * e estar pronta ANTES de pedir o código — daí as esperas entre delete e create.
   */
  async connect(companyId: string, appUrl: string, number?: string): Promise<WhatsAppStatus> {
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) return { configured: false, state: "unknown" };

    const webhookUrl = this.webhookUrl(cfg, appUrl);
    const publicUrlWarning = /localhost|127\.0\.0\.1/.test(appUrl);
    const num = number ? normalizeBrPhone(number) : null;

    if ((await this.readState(cfg)) === "open") return this.status(companyId, appUrl);

    if (num) {
      // Recria a instância do zero com o número (fluxo de pairing code).
      await this.api(cfg, "DELETE", `/instance/logout/${cfg.instance}`);
      await this.api(cfg, "DELETE", `/instance/delete/${cfg.instance}`);
      await this.waitFor(cfg, (s) => s === "missing" || s === "unknown");

      const createRes = await this.api(cfg, "POST", "/instance/create", {
        instanceName: cfg.instance,
        integration: "WHATSAPP-BAILEYS",
        number: num,
        qrcode: false,
      });
      if (!createRes?.ok && createRes?.status !== 403 && createRes?.status !== 409) {
        return { configured: true, state: "unknown", webhookUrl, publicUrlWarning };
      }
      await this.waitFor(cfg, (s) => s === "close" || s === "connecting" || s === "open");
    } else {
      // Fluxo QR: recria a instância do zero SEMPRE (não só quando "missing").
      // Uma instância presa em "connecting" de uma tentativa anterior não gera
      // QR novo — apagar e recriar garante um QR fresco e limpo. É exatamente o
      // que destrava o pareamento (o código de 8 dígitos costuma dar 401).
      await this.api(cfg, "DELETE", `/instance/logout/${cfg.instance}`, undefined, 10000);
      await this.api(cfg, "DELETE", `/instance/delete/${cfg.instance}`, undefined, 10000);
      await this.waitFor(cfg, (s) => s === "missing" || s === "unknown");
      await this.api(cfg, "POST", "/instance/create", {
        instanceName: cfg.instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      });
      await this.waitFor(cfg, (s) => s === "close" || s === "connecting" || s === "open");
    }

    // Garante o webhook apontando de volta para o app.
    await this.api(cfg, "POST", `/webhook/set/${cfg.instance}`, {
      webhook: { enabled: true, url: webhookUrl, events: WEBHOOK_EVENTS },
    });

    // Pede código de pareamento (com número) ou QR (sem número). Pode demorar a
    // materializar — mas com ORÇAMENTO DE TEMPO: no máximo ~15s tentando, para o
    // endpoint sempre responder (com o código/QR ou vazio para nova tentativa),
    // nunca ficar preso aqui.
    let pairingCode: string | undefined;
    let qrBase64: string | undefined;
    const codeDeadline = Date.now() + 15000;
    while (Date.now() < codeDeadline) {
      const path = `/instance/connect/${cfg.instance}${num ? `?number=${num}` : ""}`;
      const res = await this.api(cfg, "GET", path, undefined, 8000);
      const data = (res?.ok ? await res.json().catch(() => null) : null) as
        | { pairingCode?: string; base64?: string; qrcode?: { base64?: string } }
        | null;
      pairingCode = data?.pairingCode ?? undefined;
      const b64 = data?.base64 ?? data?.qrcode?.base64;
      if (b64) qrBase64 = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
      if ((num && pairingCode) || (!num && qrBase64)) break;
      await wait(1500);
    }

    const status = await this.status(companyId, appUrl);
    if (status.state === "open") return status;
    return {
      ...status,
      pairingCode: pairingCode ? pairingCode.replace(/(.{4})(.{4})/, "$1-$2") : undefined,
      qrBase64,
    };
  }

  /** Desconecta o WhatsApp (logout da instância). */
  async disconnect(companyId: string): Promise<void> {
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) return;
    await this.api(cfg, "DELETE", `/instance/logout/${cfg.instance}`);
  }

  /**
   * ZERA a instância: logout + delete COMPLETO no Evolution. É o "reset de
   * fábrica" para quando a instância trava num estado ruim (nem conecta, nem
   * cai direito) e nem reconectar resolve. Depois disto a instância deixa de
   * existir no servidor — o próximo "Conectar" cria uma nova do zero e gera um
   * código/QR novo. Idempotente e limitado no tempo (não trava).
   */
  async reset(companyId: string): Promise<{ ok: boolean; state: string }> {
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) return { ok: false, state: "unconfigured" };
    // logout primeiro (encerra a sessão pareada), depois delete (remove a
    // instância inteira). Timeouts próprios: mesmo se um passo engasgar, retorna.
    await this.api(cfg, "DELETE", `/instance/logout/${cfg.instance}`, undefined, 10000);
    await this.api(cfg, "DELETE", `/instance/delete/${cfg.instance}`, undefined, 10000);
    // Confirma que sumiu de verdade (estado "missing") — dá até 8s.
    const gone = await this.waitFor(cfg, (s) => s === "missing" || s === "unknown", 8000);
    return { ok: gone, state: await this.readState(cfg) };
  }

  /**
   * Conciliação idempotente — chamada periodicamente (keep-alive) e após eventos de
   * conexão. Reafirma o webhook (para nunca "desapontar" após redeploy/mudança) e, se a
   * instância caiu mas as credenciais do número ainda existem no servidor, cutuca a
   * reconexão (o Evolution reconecta sozinho, sem novo pareamento). Não recria instância
   * inexistente (isso exigiria o número + novo pareamento pelo usuário).
   */
  async reconcile(
    companyId: string,
    appUrl: string,
  ): Promise<{ state: string; rewired: boolean; reconnected: boolean }> {
    const cfg = await getWhatsAppConfig(companyId);
    if (!cfg) return { state: "unconfigured", rewired: false, reconnected: false };

    const state = await this.readState(cfg);
    if (state === "missing") return { state, rewired: false, reconnected: false };

    // Reafirma o webhook (idempotente) para garantir URL + eventos corretos.
    const setRes = await this.api(cfg, "POST", `/webhook/set/${cfg.instance}`, {
      webhook: { enabled: true, url: this.webhookUrl(cfg, appUrl), events: WEBHOOK_EVENTS },
    });
    const rewired = Boolean(setRes?.ok);

    // Caiu de fato ("close") → cutuca a reconexão com as credenciais já pareadas
    // (sem novo QR). NÃO cutuca em "connecting": esse estado também ocorre DURANTE
    // o pareamento (QR/código), e chamar /instance/connect ali RESETA o pareamento
    // em andamento (gera outro código) — era o que fazia a instância "desconectar
    // sozinha" e o código deixar de funcionar.
    let reconnected = false;
    if (state === "close") {
      const res = await this.api(cfg, "GET", `/instance/connect/${cfg.instance}`);
      reconnected = Boolean(res?.ok);
    }
    return { state, rewired, reconnected };
  }
}

let channel: WhatsAppEvolutionChannel | null = null;
export function getWhatsAppChannel(): WhatsAppEvolutionChannel {
  return channel ?? (channel = new WhatsAppEvolutionChannel());
}

/** Allowlist: se houver números definidos, o agente só responde a eles. */
export async function isWhatsAppNumberAllowed(companyId: string, externalId: string): Promise<boolean> {
  const { getAllowedNumbersRaw } = await import("./config");
  const raw = (await getAllowedNumbersRaw(companyId)).trim();
  if (!raw) return true;
  const allowed = raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map(normalizeBrPhone);
  return allowed.length === 0 || allowed.includes(normalizeBrPhone(externalId));
}
