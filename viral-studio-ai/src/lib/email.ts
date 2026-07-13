// Envio de e-mail transacional — sem dependência: usa a API HTTP do Resend
// quando RESEND_API_KEY está definida; senão, apenas registra no log do servidor
// (dev). Para produção, defina RESEND_API_KEY e EMAIL_FROM (ou troque por SMTP).
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Viral Studio <onboarding@resend.dev>";
  if (!key) {
    console.log(`[email:mock] Para: ${to}\nAssunto: ${subject}\n${text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[email] Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[email] falha ao enviar:", (e as Error).message);
    return false;
  }
}
