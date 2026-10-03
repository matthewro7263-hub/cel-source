// Transactional email through Resend's REST API (no SDK, just fetch).
//
//   RESEND_API_KEY  required to actually send; without it mail is logged and skipped
//   MAIL_FROM       "Cel <hello@your-domain.com>" (a verified Resend domain); defaults to Resend's sandbox sender
//   APP_URL         public origin used in email links, e.g. https://cel.onrender.com
//   RESEND_API_URL  override for tests / proxies
//
// sendMail never throws: an email outage must not break signup, invites or password reset.

export { appLink, appUrl } from "./app_url";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  sent: boolean;
  /** Why it wasn't sent (only set when sent is false). */
  reason?: "not_configured" | "failed";
}

const DEFAULT_FROM = "Cel <onboarding@resend.dev>";

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendMail(input: MailMessage): Promise<MailResult> {
  const msg = { ...input, subject: input.subject.replace(/[\r\n]+/g, " ").trim() };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Never print message bodies in production: they contain single-use links.
    if (process.env.NODE_ENV === "production") {
      console.warn(`[mail] RESEND_API_KEY not set; skipped "${msg.subject}"`);
    } else {
      console.log(`[mail] (not configured) to=${msg.to} subject="${msg.subject}"\n${msg.text}\n`);
    }
    return { sent: false, reason: "not_configured" };
  }
  try {
    const response = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || DEFAULT_FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[mail] Resend rejected "${msg.subject}" (${response.status}): ${detail.slice(0, 300)}`);
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[mail] failed to send "${msg.subject}":`, err instanceof Error ? err.message : err);
    return { sent: false, reason: "failed" };
  }
}
