import { normalizeBrPhone } from "@/modules/shared/phone";
import { getWhatsAppConfig, type WhatsAppConfig } from "./config";
import type { Channel, IncomingMessage } from "./types";

// Evolution API (self-hosted, WhatsApp Web via QR code — não é a API oficial da Meta).
// Documentação de referência: https://doc.evolution-api.com
// Formatos abaixo são os da v2; instâncias v1 podem exigir pequenos ajustes de payload.

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
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: Record<string, unknown>;
    };
  };
}

export type ConnectionState = "open" | "connecting" | "close" | "unknown";

export interface WhatsAppStatus {
  configured: boolean;
  state: ConnectionState;
  qrBase64?: string; // data URI do QR code quando aguardando leitura (fluxo sem número)
  pairingCode?: string; // código de confirmação digitado no celular (fluxo com número)
  number?: string; // número conectado (quando state === "open")
  webhookUrl?: string;
  publicUrlWarning?: boolean; // APP_URL é localhost → webhook de entrada não alcançável
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function phoneFromJid(jid: string): string {
  return jid.split("@")[0];
}

export class WhatsAppEvolutionChannel implements Channel {
  name = "whatsapp";

  // ---- Canal (mensagens) ----

  parseWebhook(raw: unknown): IncomingMessage | null {
    const payload = raw as EvolutionWebhookPayload;
    const data = payload?.data;
    const key = data?.key;
    if (!data || !key || key.fromMe) return null; // ignora eco das próprias mensagens do bot

    const externalId = phoneFromJid(key.remoteJid);
    const messageId = key.id;
    const text = data.message?.conversation ?? data.message?.extendedTextMessage?.text;
    if (text) return { externalId, messageId, text };

    if (data.message?.audioMessage) return { externalId, messageId, audioRef: key };
    return null;
  }

  async fetchAudio(audioRef: unknown): Promise<Blob | null> {
    const cfg = await getWhatsAppConfig();
    if (!cfg) return null;
    const res = await this.api(cfg, "POST", `/chat/getBase64FromMediaMessage/${cfg.instance}`, {
      message: { key: audioRef },
      convertToMp4: false,
    });
    if (!res?.ok) return null;
    const data = (await res.json().catch(() => null)) as { base64?: string } | null;
    if (!data?.base64) return null;
    return new Blob([Buffer.from(data.base64, "base64")], { type: "audio/ogg" });
  }

  async sendMessage(externalId: string, text: string): Promise<void> {
    // O núcleo gera **negrito** (markdown padrão do chat web); o WhatsApp usa *negrito*.
    const whatsappText = text.replace(/\*\*(.+?)\*\*/g, "*$1*");
    const cfg = await getWhatsAppConfig();
    if (!cfg) {
      console.warn("[whatsapp] Evolution não configurada — mensagem não enviada:", whatsappText);
      return;
    }
    const res = await this.api(cfg, "POST", `/message/sendText/${cfg.instance}`, {
      number: externalId,
      text: whatsappText,
    });
    if (!res?.ok) {
      console.error("[whatsapp] falha ao enviar:", res?.status, await res?.text().catch(() => ""));
    }
  }

  // ---- Gerenciamento de instância (aba Conectar) ----

  private async api(
    cfg: WhatsAppConfig,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response | null> {
    try {
      return await fetch(`${cfg.apiUrl}${path}`, {
        method,
        headers: { "content-type": "application/json", apikey: cfg.apiKey },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      console.error("[whatsapp] erro de rede:", path, err);
      return null;
    }
  }

  private webhookUrl(cfg: WhatsAppConfig, appUrl: string): string {
    return `${appUrl.replace(/\/$/, "")}/api/webhooks/whatsapp?token=${cfg.webhookToken}`;
  }

  /** Estado + QR + número. Cria nada — só lê. */
  async status(appUrl: string): Promise<WhatsAppStatus> {
    const cfg = await getWhatsAppConfig();
    if (!cfg) return { configured: false, state: "unknown" };

    const base: WhatsAppStatus = {
      configured: true,
      state: "unknown",
      webhookUrl: this.webhookUrl(cfg, appUrl),
      publicUrlWarning: /localhost|127\.0\.0\.1/.test(appUrl),
    };

    const stateRes = await this.api(cfg, "GET", `/instance/connectionState/${cfg.instance}`);
    if (!stateRes || stateRes.status === 404) return base; // instância ainda não existe
    if (!stateRes.ok) return base;

    const data = (await stateRes.json().catch(() => null)) as
      | { instance?: { state?: string } }
      | null;
    const raw = data?.instance?.state;
    base.state = raw === "open" ? "open" : raw === "connecting" ? "connecting" : raw === "close" ? "close" : "unknown";

    if (base.state === "open") {
      base.number = await this.connectedNumber(cfg);
    }
    return base;
  }

  private async connectedNumber(cfg: WhatsAppConfig): Promise<string | undefined> {
    const res = await this.api(cfg, "GET", `/instance/fetchInstances?instanceName=${cfg.instance}`);
    if (!res?.ok) return undefined;
    const data = (await res.json().catch(() => null)) as unknown;
    // v2 costuma retornar array; formatos variam — busca defensiva por um JID de dono.
    const list = Array.isArray(data) ? data : [data];
    for (const item of list) {
      const rec = item as Record<string, unknown>;
      const inst = (rec.instance as Record<string, unknown>) ?? rec;
      const jid = (inst.ownerJid ?? inst.owner ?? inst.wuid) as string | undefined;
      if (jid) return phoneFromJid(jid);
    }
    return undefined;
  }

  /** Lê o estado da instância: open | connecting | close | missing | unknown. */
  private async readState(cfg: WhatsAppConfig): Promise<string> {
    const res = await this.api(cfg, "GET", `/instance/connectionState/${cfg.instance}`);
    if (!res) return "unknown";
    if (res.status === 404) return "missing";
    if (!res.ok) return "unknown";
    const data = (await res.json().catch(() => null)) as
      | { instance?: { state?: string }; state?: string }
      | null;
    return data?.instance?.state ?? data?.state ?? "close";
  }

  /** Aguarda (com polling) até a condição ser satisfeita, ou estourar o timeout. */
  private async waitFor(
    cfg: WhatsAppConfig,
    cond: (s: string) => boolean,
    tries = 12,
    gap = 600,
  ): Promise<boolean> {
    for (let i = 0; i < tries; i++) {
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
   * e estar pronta ANTES de pedir o código — por isso as esperas entre delete e create
   * (padrão validado no barberpro; sem elas o código sai inválido).
   */
  async connect(appUrl: string, number?: string): Promise<WhatsAppStatus> {
    const cfg = await getWhatsAppConfig();
    if (!cfg) return { configured: false, state: "unknown" };

    const webhookUrl = this.webhookUrl(cfg, appUrl);
    const publicUrlWarning = /localhost|127\.0\.0\.1/.test(appUrl);
    const num = number ? normalizeBrPhone(number) : null;

    if ((await this.readState(cfg)) === "open") return this.status(appUrl);

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
    } else if ((await this.readState(cfg)) === "missing") {
      await this.api(cfg, "POST", "/instance/create", {
        instanceName: cfg.instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      });
      await this.waitFor(cfg, (s) => s === "close" || s === "connecting" || s === "open");
    }

    // Garante o webhook apontando de volta para o app.
    await this.api(cfg, "POST", `/webhook/set/${cfg.instance}`, {
      webhook: { enabled: true, url: webhookUrl, events: ["MESSAGES_UPSERT"] },
    });

    // Pede código de pareamento (com número) ou QR (sem número). Pode demorar a materializar.
    let pairingCode: string | undefined;
    let qrBase64: string | undefined;
    for (let i = 0; i < 6; i++) {
      const path = `/instance/connect/${cfg.instance}${num ? `?number=${num}` : ""}`;
      const res = await this.api(cfg, "GET", path);
      const data = (res?.ok ? await res.json().catch(() => null) : null) as
        | { pairingCode?: string; base64?: string; qrcode?: { base64?: string } }
        | null;
      pairingCode = data?.pairingCode ?? undefined;
      const b64 = data?.base64 ?? data?.qrcode?.base64;
      if (b64) qrBase64 = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
      if ((num && pairingCode) || (!num && qrBase64)) break;
      await wait(1500);
    }

    const status = await this.status(appUrl);
    if (status.state === "open") return status;
    return {
      ...status,
      pairingCode: pairingCode ? pairingCode.replace(/(.{4})(.{4})/, "$1-$2") : undefined,
      qrBase64,
    };
  }

  /** Desconecta o WhatsApp (logout da instância). */
  async disconnect(): Promise<void> {
    const cfg = await getWhatsAppConfig();
    if (!cfg) return;
    await this.api(cfg, "DELETE", `/instance/logout/${cfg.instance}`);
  }
}
